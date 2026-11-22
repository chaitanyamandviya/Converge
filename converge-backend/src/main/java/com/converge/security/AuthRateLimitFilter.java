package com.converge.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * In-memory per-IP sliding/fixed window rate limiter for unauthenticated auth endpoints.
 */
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> RATE_LIMITED_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/signup",
            "/api/auth/google",
            "/api/auth/forgot-password"
    );

    private static final int MAX_TRACKED_KEYS = 10_000;

    private final int maxAttemptsPerWindow;
    private final long windowMs;
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    public AuthRateLimitFilter() {
        this(20, 60_000L);
    }

    public AuthRateLimitFilter(int maxAttemptsPerWindow, long windowMs) {
        this.maxAttemptsPerWindow = Math.max(1, maxAttemptsPerWindow);
        this.windowMs = Math.max(1_000L, windowMs);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String uri = request.getRequestURI();
        if (!"POST".equalsIgnoreCase(request.getMethod()) || !RATE_LIMITED_PATHS.contains(uri)) {
            filterChain.doFilter(request, response);
            return;
        }

        long now = System.currentTimeMillis();
        cleanupIfOversized(now);

        String remoteAddr = request.getRemoteAddr();
        String clientKey = (remoteAddr != null && !remoteAddr.isBlank() ? remoteAddr : "unknown") + "|" + uri;
        WindowCounter counter = counters.compute(clientKey, (k, existing) -> {
            if (existing == null || now - existing.windowStartMs >= windowMs) {
                return new WindowCounter(now);
            }
            return existing;
        });

        int count = counter.attempts.incrementAndGet();
        if (count > maxAttemptsPerWindow) {
            long retryAfterSeconds = Math.max(1L, (counter.windowStartMs + windowMs - now + 999L) / 1000L);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"Too many authentication attempts. Please try again shortly.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void cleanupIfOversized(long now) {
        if (counters.size() < MAX_TRACKED_KEYS) {
            return;
        }
        counters.entrySet().removeIf(entry -> now - entry.getValue().windowStartMs >= windowMs);
        if (counters.size() >= MAX_TRACKED_KEYS) {
            counters.clear();
        }
    }

    private static final class WindowCounter {
        final long windowStartMs;
        final AtomicInteger attempts = new AtomicInteger(0);

        WindowCounter(long windowStartMs) {
            this.windowStartMs = windowStartMs;
        }
    }
}
