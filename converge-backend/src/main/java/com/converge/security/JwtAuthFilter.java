package com.converge.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Set<String> ALLOWED_ROLES = Set.of(
            "SYSTEM_ADMIN",
            "BRAND_MANAGER",
            "AGENCY_MANAGER",
            "CREATOR"
    );

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            try {
                Claims claims = jwtService.parseClaims(token);
                String typ = claims.get("typ", String.class);
                if (JwtService.TOKEN_TYPE_IG_OAUTH_STATE.equals(typ)) {
                    SecurityContextHolder.clearContext();
                    filterChain.doFilter(request, response);
                    return;
                }
                String email = claims.getSubject();
                String role = claims.get("role", String.class);
                String uid = claims.get("uid", String.class);
                Boolean verifiedClaim = claims.get("verified", Boolean.class);
                if (email == null || email.isBlank()
                        || role == null || !ALLOWED_ROLES.contains(role)
                        || uid == null || uid.isBlank()) {
                    SecurityContextHolder.clearContext();
                } else {
                    UUID userId = UUID.fromString(uid);
                    var auth = new UsernamePasswordAuthenticationToken(
                            email.trim().toLowerCase(),
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role))
                    );
                    auth.setDetails(Map.of(
                            "uid", userId,
                            "verified", verifiedClaim != null ? verifiedClaim : Boolean.TRUE
                    ));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception ignored) {
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
