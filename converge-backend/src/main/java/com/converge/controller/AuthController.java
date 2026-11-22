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
    public ResponseEntity<?> signup(@RequestBody(required = false) Map<String, String> body) {
        String name = optString(body, "name");
        String email = optString(body, "email");
        String password = optRaw(body, "password");
        String activationToken = optString(body, "token");
        if (activationToken.isEmpty()) {
            activationToken = optString(body, "activationToken");
        }
        if (name.length() < 2 || email.isEmpty() || password.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name (min 2 chars), valid email, and password (min 8 chars) are required."));
        }
        return ResponseEntity.ok(authService.signup(name, email, password, activationToken));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody(required = false) Map<String, String> body) {
        String email = optString(body, "email");
        String password = optRaw(body, "password");
        if (email.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required."));
        }
        return ResponseEntity.ok(authService.login(email, password));
    }

    @PostMapping("/google")
    public ResponseEntity<?> google(@RequestBody(required = false) Map<String, String> body) {
        String idToken = body != null ? body.get("idToken") : null;
        String accessToken = body != null ? body.get("accessToken") : null;
        return ResponseEntity.ok(authService.googleSignIn(idToken, accessToken));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody(required = false) Map<String, String> body) {
        String email = optString(body, "email");
        if (!email.isEmpty()) {
            authService.forgotPassword(email);
        }
        return ResponseEntity.ok(Map.of("message", "Password reset instructions have been dispatched if the account exists."));
    }

    private static String optString(Map<String, String> body, String key) {
        if (body == null) return "";
        String v = body.get(key);
        return v != null ? v.trim() : "";
    }

    private static String optRaw(Map<String, String> body, String key) {
        if (body == null) return "";
        String v = body.get(key);
        return v != null ? v : "";
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
