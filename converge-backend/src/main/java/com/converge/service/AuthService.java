package com.converge.service;

import com.converge.entity.User;
import com.converge.repository.BrandRepository;
import com.converge.repository.UserRepository;
import com.converge.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final BrandRepository brandRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final String adminEmail;
    private final String googleClientId;
    private final RestClient googleClient = RestClient.create("https://oauth2.googleapis.com");

    public AuthService(
            UserRepository userRepository,
            BrandRepository brandRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            @Value("${app.admin.email}") String adminEmail,
            @Value("${app.google.client-id}") String googleClientId) {
        this.userRepository = userRepository;
        this.brandRepository = brandRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.adminEmail = adminEmail;
        this.googleClientId = googleClientId;
    }

    public Map<String, Object> signup(String name, String email, String password) {
        if (adminEmail != null && !adminEmail.isBlank() && email.trim().equalsIgnoreCase(adminEmail.trim())) {
            throw new IllegalArgumentException("This email is reserved for System Admin.");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("An account with this email already exists.");
        }
        User user = new User();
        user.setName(name.trim());
        user.setEmail(email.trim().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(email.equalsIgnoreCase(adminEmail) ? "SYSTEM_ADMIN" : "BRAND_MANAGER");
        user.setVerified(true);
        user = userRepository.save(user);
        syncManagerBrands(user);

        String token = jwtService.generateToken(user);
        return authResponse(user, token);
    }

    public Map<String, Object> login(String email, String password) {
        User user = userRepository.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password."));

        if (!matchesPassword(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password.");
        }

        syncManagerBrands(user);
        String token = jwtService.generateToken(user);
        return authResponse(user, token);
    }

    public Map<String, Object> googleSignIn(String idToken, String accessToken) {
        if ((idToken == null || idToken.isBlank()) && (accessToken == null || accessToken.isBlank())) {
            throw new IllegalArgumentException("Google authentication token is required.");
        }
        String email = null;
        String name = null;
        String googleId = null;

        try {
            if (idToken != null && !idToken.isBlank()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> info = googleClient.get()
                        .uri("/tokeninfo?id_token={token}", idToken)
                        .retrieve()
                        .body(Map.class);
                if (info != null && info.get("email") != null) {
                    String aud = String.valueOf(info.get("aud"));
                    if (googleClientId != null && !googleClientId.isBlank() && !googleClientId.equals(aud)) {
                        throw new IllegalArgumentException("Google token audience mismatch.");
                    }
                    email = String.valueOf(info.get("email"));
                    name = info.get("name") != null ? String.valueOf(info.get("name")) : email.split("@")[0];
                    googleId = info.get("sub") != null ? String.valueOf(info.get("sub")) : null;
                }
            } else {
                @SuppressWarnings("unchecked")
                Map<String, Object> tokenInfo = googleClient.get()
                        .uri("/tokeninfo?access_token={token}", accessToken)
                        .retrieve()
                        .body(Map.class);
                if (tokenInfo != null && googleClientId != null && !googleClientId.isBlank()) {
                    Object audObj = tokenInfo.get("aud") != null ? tokenInfo.get("aud") : tokenInfo.get("issued_to");
                    if (audObj != null && !googleClientId.equals(String.valueOf(audObj))) {
                        throw new IllegalArgumentException("Google token audience mismatch.");
                    }
                }
                RestClient userInfoClient = RestClient.create("https://www.googleapis.com");
                @SuppressWarnings("unchecked")
                Map<String, Object> userInfo = userInfoClient.get()
                        .uri("/oauth2/v3/userinfo")
                        .header("Authorization", "Bearer " + accessToken)
                        .retrieve()
                        .body(Map.class);
                if (userInfo != null && userInfo.get("email") != null) {
                    email = String.valueOf(userInfo.get("email"));
                    name = userInfo.get("name") != null ? String.valueOf(userInfo.get("name")) : email.split("@")[0];
                    googleId = userInfo.get("sub") != null ? String.valueOf(userInfo.get("sub")) : null;
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Unable to verify Google Sign-In token.");
        }

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Google account email could not be verified.");
        }

        final String finalEmail = email.trim().toLowerCase();
        final String finalName = (name != null && !name.isBlank()) ? name : finalEmail.split("@")[0];
        final String finalGoogleId = googleId;

        User user = userRepository.findByEmailIgnoreCase(finalEmail).orElseGet(() -> {
            User created = new User();
            created.setEmail(finalEmail);
            created.setName(finalName);
            created.setGoogleId(finalGoogleId);
            created.setRole(finalEmail.equalsIgnoreCase(adminEmail) ? "SYSTEM_ADMIN" : "BRAND_MANAGER");
            created.setVerified(true);
            return userRepository.save(created);
        });

        syncManagerBrands(user);
        String token = jwtService.generateToken(user);
        return authResponse(user, token);
    }

    private void syncManagerBrands(User user) {
        brandRepository.findByManagerEmailIgnoreCase(user.getEmail()).forEach(brand -> {
            boolean dirty = false;
            if (!user.getId().equals(brand.getManagerId())) {
                brand.setManagerId(user.getId());
                dirty = true;
            }
            if ("PENDING".equalsIgnoreCase(brand.getStatus())) {
                brand.setStatus("ACTIVE");
                dirty = true;
            }
            if (dirty) {
                brand.setUpdatedAt(Instant.now());
                brandRepository.save(brand);
            }
        });
    }

    public void forgotPassword(String email) {
        userRepository.findByEmailIgnoreCase(email.trim()).ifPresent(user ->
                emailService.sendPasswordResetEmail(user.getEmail(), user.getName())
        );
    }

    private boolean matchesPassword(String raw, String stored) {
        if (stored == null || raw == null) return false;
        if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
            return passwordEncoder.matches(raw, stored);
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-512");
            String sha512B64 = Base64.getEncoder().encodeToString(md.digest(raw.getBytes(StandardCharsets.UTF_8)));
            if (sha512B64.equals(stored)) return true;
        } catch (Exception ignored) {}
        return raw.equals(stored);
    }

    public Map<String, Object> authResponse(User user, String token) {
        return Map.of(
                "token", token,
                "user", Map.of(
                        "id", user.getId().toString(),
                        "name", user.getName(),
                        "email", user.getEmail(),
                        "role", user.getRole(),
                        "verified", user.isVerified()
                )
        );
    }
}
