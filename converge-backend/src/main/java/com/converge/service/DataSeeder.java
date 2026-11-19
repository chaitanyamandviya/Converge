package com.converge.service;

import com.converge.entity.User;
import com.converge.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPasswordHash;

    public DataSeeder(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.email}") String adminEmail,
            @Value("${app.admin.password-hash}") String adminPasswordHash) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail;
        this.adminPasswordHash = adminPasswordHash;
    }

    @Override
    public void run(String... args) {
        if (adminEmail != null && !adminEmail.isBlank() && !userRepository.existsByEmailIgnoreCase(adminEmail)) {
            User admin = new User();
            admin.setName("System Admin");
            admin.setEmail(adminEmail.trim().toLowerCase());
            admin.setPasswordHash(adminPasswordHash != null && !adminPasswordHash.isBlank()
                    ? adminPasswordHash
                    : passwordEncoder.encode("Admin@12345"));
            admin.setRole("SYSTEM_ADMIN");
            admin.setVerified(true);
            userRepository.save(admin);
        }
    }
}
