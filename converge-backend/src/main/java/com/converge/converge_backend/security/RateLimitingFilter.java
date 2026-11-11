package com.converge.converge_backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Enterprise Request Throttling and Rate Limiting Filter.
 * Protects auth endpoints against brute-force attacks and general APIs against denial-of-service,
 * implementing sliding-window token limiting with standard RFC 6585 (429 Too Many Requests) responses.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingFilter.class);

    // Rate limits (requests per minute)
    private static final int AUTH_LIMIT_PER_MINUTE = 30;     // /api/auth/**
    private static final int GENERAL_LIMIT_PER_MINUTE = 180;  // /api/**
    private static final long WINDOW_MS = 60_000L;          // 1 minute sliding window

    private final Map<String, ClientWindow> clientWindows = new ConcurrentHashMap<>();

    private static class ClientWindow {
        long windowStartMs;
        final AtomicInteger count = new AtomicInteger(0);

        ClientWindow(long startMs) {
            this.windowStartMs = startMs;
        }
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // Skip rate limiting for CORS preflight, health checks, actuator
        String uri = request.getRequestURI();
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())
                || uri.equals("/healthz")
                || uri.startsWith("/api/health")
                || uri.startsWith("/actuator")
                || uri.equals("/")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        boolean isAuthEndpoint = uri.startsWith("/api/auth");
        int maxAllowed = isAuthEndpoint ? AUTH_LIMIT_PER_MINUTE : GENERAL_LIMIT_PER_MINUTE;
        String bucketKey = clientIp + ":" + (isAuthEndpoint ? "auth" : "api");

        long now = System.currentTimeMillis();
        ClientWindow window = clientWindows.compute(bucketKey, (k, existing) -> {
            if (existing == null || (now - existing.windowStartMs) >= WINDOW_MS) {
                ClientWindow fresh = new ClientWindow(now);
                fresh.count.set(1);
                return fresh;
            } else {
                existing.count.incrementAndGet();
                return existing;
            }
        });

        int currentCount = window.count.get();
        int remaining = Math.max(0, maxAllowed - currentCount);
        long resetSeconds = Math.max(1, (WINDOW_MS - (now - window.windowStartMs)) / 1000);

        response.setHeader("X-RateLimit-Limit", String.valueOf(maxAllowed));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("X-RateLimit-Reset", String.valueOf(resetSeconds));

        if (currentCount > maxAllowed) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(resetSeconds));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(String.format(
                    "{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded (%d requests/min). Please try again in %d seconds.\",\"retryAfterSeconds\":%d}",
                    maxAllowed, resetSeconds, resetSeconds
            ));
            log.warn("[RATE-LIMIT] Client {} exceeded limit on {} ({}/{} reqs)", clientIp, uri, currentCount, maxAllowed);
            return;
        }

        // Periodically purge stale windows to prevent memory creep (1 in every 200 requests)
        if (Math.random() < 0.005) {
            cleanupStaleBuckets(now);
        }

        filterChain.doFilter(request, response);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    private void cleanupStaleBuckets(long now) {
        clientWindows.entrySet().removeIf(entry -> (now - entry.getValue().windowStartMs) > (WINDOW_MS * 2));
    }
}
