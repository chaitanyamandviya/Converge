package com.converge.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final AuthRateLimitFilter authRateLimitFilter;
    private final String frontendUrl;
    private final String extraCorsOrigins;

    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            @Value("${app.frontend.url:https://converge-etp.pages.dev}") String frontendUrl) {
        this(jwtAuthFilter, new AuthRateLimitFilter(), frontendUrl, "");
    }

    @Autowired
    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            @Value("${app.frontend.url:https://converge-etp.pages.dev}") String frontendUrl,
            @Value("${app.cors.extra-origins:}") String extraCorsOrigins) {
        this(jwtAuthFilter, new AuthRateLimitFilter(), frontendUrl, extraCorsOrigins);
    }

    SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            AuthRateLimitFilter authRateLimitFilter,
            String frontendUrl,
            String extraCorsOrigins) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.authRateLimitFilter = authRateLimitFilter;
        this.frontendUrl = frontendUrl;
        this.extraCorsOrigins = extraCorsOrigins;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(headers -> headers
                .contentTypeOptions(Customizer.withDefaults())
                .frameOptions(frame -> frame.deny())
                .referrerPolicy(ref -> ref.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                .cacheControl(Customizer.withDefaults())
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, authEx) -> writeJsonError(res, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required."))
                .accessDeniedHandler((req, res, deniedEx) -> writeJsonError(res, HttpServletResponse.SC_FORBIDDEN, "Access denied."))
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/", "/api/health", "/api/auth/config", "/api/public/reports/*").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/signup", "/api/auth/login", "/api/auth/google", "/api/auth/forgot-password").permitAll()
                .requestMatchers("/api/auth/me").authenticated()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(authRateLimitFilter, JwtAuthFilter.class);

        return http.build();
    }

    private static void writeJsonError(HttpServletResponse res, int status, String message) throws java.io.IOException {
        res.setStatus(status);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.getWriter().write("{\"error\":\"" + message + "\"}");
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        Set<String> patterns = new LinkedHashSet<>();
        if (frontendUrl != null && !frontendUrl.isBlank()) {
            patterns.add(frontendUrl.trim().replaceAll("/+$", ""));
        }
        if (extraCorsOrigins != null && !extraCorsOrigins.isBlank()) {
            for (String origin : extraCorsOrigins.split(",")) {
                String trimmed = origin.trim().replaceAll("/+$", "");
                if (!trimmed.isEmpty()) {
                    patterns.add(trimmed);
                }
            }
        }
        patterns.addAll(List.of(
                "https://converge-etp.pages.dev",
                "https://converge.run.place",
                "http://localhost:*",
                "https://localhost:*",
                "http://127.0.0.1:*",
                "https://127.0.0.1:*"
        ));
        config.setAllowedOriginPatterns(new ArrayList<>(patterns));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        config.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
