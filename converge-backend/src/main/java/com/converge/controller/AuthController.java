package com.converge.controller;

import com.converge.entity.User;
import com.converge.repository.UserRepository;
import com.converge.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final String googleClientId;

    public AuthController(
            AuthService authService,
            UserRepository userRepository,
            @Value("${app.google.client-id:}") String googleClientId) {
        this.authService = authService;
        this.userRepository = userRepository;
        this.googleClientId = googleClientId;
    }

    @GetMapping("/config")
    public Map<String, String> config() {
        return Map.of("googleClientId", googleClientId != null ? googleClientId : "");
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "");
        String email = body.getOrDefault("email", "");
        String password = body.getOrDefault("password", "");
        if (name.isBlank() || email.isBlank() || password.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name, valid email, and password (min 6 chars) are required."));
        }
        return ResponseEntity.ok(authService.signup(name, email, password));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "");
        String password = body.getOrDefault("password", "");
        return ResponseEntity.ok(authService.login(email, password));
    }

    @PostMapping("/google")
    public ResponseEntity<?> google(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.googleSignIn(
                body.get("idToken"),
                body.get("accessToken")
        ));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "");
        if (!email.isBlank()) {
            authService.forgotPassword(email);
        }
        return ResponseEntity.ok(Map.of("message", "Password reset instructions have been dispatched if the account exists."));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        User user = userRepository.findByEmailIgnoreCase(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return ResponseEntity.ok(Map.of(
                "id", user.getId().toString(),
                "name", user.getName(),
                "email", user.getEmail(),
                "role", user.getRole(),
                "verified", user.isVerified()
        ));
    }
}
