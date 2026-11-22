package com.converge.service;

import com.converge.entity.Agency;
import com.converge.entity.Brand;
import com.converge.entity.User;
import com.converge.repository.AgencyRepository;
import com.converge.repository.BrandRepository;
import com.converge.repository.UserRepository;
import com.converge.security.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class AuthService {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final UserRepository userRepository;
    private final BrandRepository brandRepository;
    private final AgencyRepository agencyRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final String adminEmail;
    private final String googleClientId;
    private final RestClient googleClient;
    private final RestClient googleUserInfoClient;

    public AuthService(
            UserRepository userRepository,
            BrandRepository brandRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            String adminEmail,
            String googleClientId) {
        this(
                userRepository,
                brandRepository,
                null,
                passwordEncoder,
                jwtService,
                emailService,
                adminEmail,
                googleClientId,
                buildGoogleRestClient("https://oauth2.googleapis.com"),
                buildGoogleRestClient("https://www.googleapis.com")
        );
    }

    @Autowired
    public AuthService(
            UserRepository userRepository,
            BrandRepository brandRepository,
            AgencyRepository agencyRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            @Value("${app.admin.email}") String adminEmail,
            @Value("${app.google.client-id}") String googleClientId) {
        this(
                userRepository,
                brandRepository,
                agencyRepository,
                passwordEncoder,
                jwtService,
                emailService,
                adminEmail,
                googleClientId,
                buildGoogleRestClient("https://oauth2.googleapis.com"),
                buildGoogleRestClient("https://www.googleapis.com")
        );
    }

    AuthService(
            UserRepository userRepository,
            BrandRepository brandRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            String adminEmail,
            String googleClientId,
            RestClient googleClient,
            RestClient googleUserInfoClient) {
        this(
                userRepository,
                brandRepository,
                null,
                passwordEncoder,
                jwtService,
                emailService,
                adminEmail,
                googleClientId,
                googleClient,
                googleUserInfoClient
        );
    }

    AuthService(
            UserRepository userRepository,
            BrandRepository brandRepository,
            AgencyRepository agencyRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            String adminEmail,
            String googleClientId,
            RestClient googleClient,
            RestClient googleUserInfoClient) {
        this.userRepository = userRepository;
        this.brandRepository = brandRepository;
        this.agencyRepository = agencyRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.adminEmail = adminEmail != null ? adminEmail.trim().toLowerCase() : "";
        this.googleClientId = googleClientId != null ? googleClientId.trim() : "";
        this.googleClient = googleClient;
        this.googleUserInfoClient = googleUserInfoClient;
    }

    private static RestClient buildGoogleRestClient(String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(10));
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
    }

    public Map<String, Object> signup(String name, String email, String password) {
        return signup(name, email, password, null);
    }

    @Transactional
    public Map<String, Object> signup(String name, String email, String password, String activationToken) {
        String cleanName = name != null ? name.trim() : "";
        String normalizedEmail = email != null ? email.trim().toLowerCase() : "";
        if (cleanName.length() < 2 || cleanName.length() > 120) {
            throw new IllegalArgumentException("Name must be between 2 and 120 characters.");
        }
        if (normalizedEmail.isEmpty() || normalizedEmail.length() > 254 || !EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new IllegalArgumentException("Please enter a valid email address.");
        }
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Password must not exceed 72 UTF-8 bytes.");
        }
        if (!adminEmail.isEmpty() && normalizedEmail.equalsIgnoreCase(adminEmail)) {
            throw new IllegalArgumentException("This email is reserved for System Admin.");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("An account with this email already exists.");
        }

        List<Brand> assignedBrands = brandRepository.findByManagerEmailIgnoreCase(normalizedEmail);
        String providedToken = activationToken != null ? activationToken.trim() : "";
        boolean verifiedByInviteToken = false;

        if (!assignedBrands.isEmpty()) {
            verifiedByInviteToken = matchesAnyBrandActivationToken(assignedBrands, providedToken);
            if (!verifiedByInviteToken) {
                throw new IllegalArgumentException("An invited workspace already exists for this email. Open the onboarding link from your welcome email or continue with Google Sign-In.");
            }
        }
        boolean verifiedByAgencyLink = hasActiveAgencyAssignment(normalizedEmail);

        User user = new User();
        user.setName(cleanName);
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole("BRAND_MANAGER");
        user.setVerified(verifiedByInviteToken || verifiedByAgencyLink);
        user = userRepository.save(user);

        if (verifiedByInviteToken) {
            syncManagerBrands(user);
        }

        String token = jwtService.generateToken(user);
        return authResponse(user, token);
    }

    public Map<String, Object> login(String email, String password) {
        String normalizedEmail = email != null ? email.trim().toLowerCase() : "";
        if (normalizedEmail.isEmpty() || password == null || password.isEmpty()) {
            throw new IllegalArgumentException("Invalid email or password.");
        }
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password."));

        if (!matchesPassword(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password.");
        }

        if (!user.isVerified() && hasActiveAgencyAssignment(normalizedEmail)) {
            user.setVerified(true);
            user = userRepository.save(user);
        }
        if (user.isVerified()) {
            syncManagerBrands(user);
        }
        String token = jwtService.generateToken(user);
        return authResponse(user, token);
    }

    private boolean hasActiveAgencyAssignment(String email) {
        if (agencyRepository == null || email == null || email.isBlank()) {
            return false;
        }
        List<Agency> agencies = agencyRepository.findByContactEmailIgnoreCase(email);
        return agencies != null && agencies.stream().anyMatch(a -> !"DRAFT".equalsIgnoreCase(a.getStatus()));
    }

    @Transactional
    public Map<String, Object> googleSignIn(String idToken, String accessToken) {
        if (googleClientId.isEmpty()) {
            throw new IllegalStateException("Google Sign-In is not configured on this server.");
        }
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
                if (info == null || info.get("email") == null) {
                    throw new IllegalArgumentException("Unable to verify Google Sign-In token.");
                }
                Object audObj = info.get("aud");
                if (audObj == null || !googleClientId.equals(String.valueOf(audObj))) {
                    throw new IllegalArgumentException("Google token audience mismatch.");
                }
                if (!isGoogleEmailVerified(info.get("email_verified"))) {
                    throw new IllegalArgumentException("Google account email must be verified before signing in.");
                }
                email = String.valueOf(info.get("email"));
                name = info.get("name") != null ? String.valueOf(info.get("name")) : email.split("@")[0];
                googleId = info.get("sub") != null ? String.valueOf(info.get("sub")) : null;
            } else {
                @SuppressWarnings("unchecked")
                Map<String, Object> tokenInfo = googleClient.get()
                        .uri("/tokeninfo?access_token={token}", accessToken)
                        .retrieve()
                        .body(Map.class);
                if (tokenInfo == null) {
                    throw new IllegalArgumentException("Unable to verify Google Sign-In token.");
                }
                Object audObj = tokenInfo.get("aud") != null ? tokenInfo.get("aud") : tokenInfo.get("issued_to");
                if (audObj == null || !googleClientId.equals(String.valueOf(audObj))) {
                    throw new IllegalArgumentException("Google token audience mismatch.");
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> userInfo = googleUserInfoClient.get()
                        .uri("/oauth2/v3/userinfo")
                        .header("Authorization", "Bearer " + accessToken)
                        .retrieve()
                        .body(Map.class);
                if (userInfo == null || userInfo.get("email") == null) {
                    throw new IllegalArgumentException("Google account email could not be verified.");
                }
                boolean verified = isGoogleEmailVerified(userInfo.get("email_verified"))
                        || isGoogleEmailVerified(tokenInfo.get("email_verified"));
                if (!verified) {
                    throw new IllegalArgumentException("Google account email must be verified before signing in.");
                }
                email = String.valueOf(userInfo.get("email"));
                name = userInfo.get("name") != null ? String.valueOf(userInfo.get("name")) : email.split("@")[0];
                googleId = userInfo.get("sub") != null ? String.valueOf(userInfo.get("sub")) : null;
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Unable to verify Google Sign-In token.");
        }

        if (email == null || email.isBlank() || googleId == null || googleId.isBlank()) {
            throw new IllegalArgumentException("Google account identity could not be verified.");
        }

        final String finalEmail = email.trim().toLowerCase();
        final String finalName = (name != null && !name.isBlank()) ? name.trim() : finalEmail.split("@")[0];
        final String finalGoogleId = googleId.trim();

        User user = userRepository.findByEmailIgnoreCase(finalEmail).map(existing -> {
            if (existing.getGoogleId() != null && !existing.getGoogleId().isBlank()) {
                if (!existing.getGoogleId().equals(finalGoogleId)) {
                    throw new IllegalArgumentException("Google account mismatch for this email.");
                }
            } else {
                // If an unverified password signup existed for this email before the mailbox owner signed in via Google,
                // invalidate the unverified password and bind the verified Google subject.
                if (!existing.isVerified()) {
                    existing.setPasswordHash(null);
                    existing.setName(finalName);
                }
                existing.setGoogleId(finalGoogleId);
            }
            existing.setVerified(true);
            return userRepository.save(existing);
        }).orElseGet(() -> {
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

    private static boolean isGoogleEmailVerified(Object val) {
        if (val instanceof Boolean b) {
            return b;
        }
        return val != null && "true".equalsIgnoreCase(String.valueOf(val).trim());
    }

    private static boolean matchesAnyBrandActivationToken(List<Brand> brands, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return false;
        }
        String candidateHash = sha256Hex(rawToken.trim());
        byte[] candidateBytes = candidateHash.getBytes(StandardCharsets.UTF_8);
        for (Brand b : brands) {
            String storedHash = b.getActivationToken();
            if (storedHash != null && !storedHash.isBlank()
                    && MessageDigest.isEqual(storedHash.getBytes(StandardCharsets.UTF_8), candidateBytes)) {
                return true;
            }
        }
        return false;
    }

    public static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private void syncManagerBrands(User user) {
        brandRepository.findByManagerEmailIgnoreCase(user.getEmail()).forEach(brand -> {
            boolean dirty = false;
            if (!user.getId().equals(brand.getManagerId())) {
                brand.setManagerId(user.getId());
                dirty = true;
            }
            if (brand.getActivationToken() != null) {
                brand.setActivationToken(null);
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
        if (email == null || email.isBlank()) {
            return;
        }
        userRepository.findByEmailIgnoreCase(email.trim()).ifPresent(user ->
                emailService.sendPasswordResetEmail(user.getEmail(), user.getName())
        );
    }

    private boolean matchesPassword(String raw, String stored) {
        if (stored == null || raw == null || raw.isEmpty()) return false;
        if (raw.getBytes(StandardCharsets.UTF_8).length > 72) return false;
        if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
            return passwordEncoder.matches(raw, stored);
        }
        return false;
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
