package com.converge.service;

import com.converge.ConvergeApplication;
import com.converge.entity.User;
import com.converge.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPasswordHash;
    private final Environment env;

    public DataSeeder(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.email}") String adminEmail,
            @Value("${app.admin.password-hash}") String adminPasswordHash) {
        this(userRepository, passwordEncoder, adminEmail, adminPasswordHash, null);
    }

    @Autowired
    public DataSeeder(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.email}") String adminEmail,
            @Value("${app.admin.password-hash}") String adminPasswordHash,
            Environment env) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail;
        this.adminPasswordHash = adminPasswordHash;
        this.env = env;
    }

    @Override
    public void run(String... args) {
        if (adminEmail == null || adminEmail.isBlank() || userRepository.existsByEmailIgnoreCase(adminEmail)) {
            return;
        }
        String trimmedHash = adminPasswordHash != null ? adminPasswordHash.trim() : "";
        String passwordHash;
        if (!trimmedHash.isEmpty()) {
            if (!isBcryptHash(trimmedHash)) {
                throw new IllegalStateException("ADMIN_PASSWORD_HASH must be a valid BCrypt hash ($2a$, $2b$, or $2y$).");
            }
            passwordHash = trimmedHash;
        } else if (ConvergeApplication.isHostedProduction(env)) {
            throw new IllegalStateException("ADMIN_PASSWORD_HASH must be configured before seeding System Admin in production.");
        } else {
            byte[] bytes = new byte[18];
            new SecureRandom().nextBytes(bytes);
            String generated = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            passwordHash = passwordEncoder.encode(generated);
            log.warn("Seeded local System Admin {} with a locked random password because ADMIN_PASSWORD_HASH is unset; configure ADMIN_PASSWORD_HASH or sign in with Google.",
                    adminEmail.trim().toLowerCase());
        }

        User admin = new User();
        admin.setName("System Admin");
        admin.setEmail(adminEmail.trim().toLowerCase());
        admin.setPasswordHash(passwordHash);
        admin.setRole("SYSTEM_ADMIN");
        admin.setVerified(true);
        userRepository.save(admin);
    }

    private static boolean isBcryptHash(String hash) {
        return hash.length() >= 59
                && (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$"));
    }
}
