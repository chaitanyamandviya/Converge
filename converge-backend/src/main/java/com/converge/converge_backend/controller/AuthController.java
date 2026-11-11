package com.converge.converge_backend.controller;

import com.converge.converge_backend.dto.AuthRequest;
import com.converge.converge_backend.dto.AuthResponse;
import com.converge.converge_backend.entity.BrandEntity;
import com.converge.converge_backend.repository.BrandRepository;
import com.converge.converge_backend.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final BrandRepository brandRepository;

    public AuthController(AuthService authService, BrandRepository brandRepository) {
        this.authService = authService;
        this.brandRepository = brandRepository;
    }

    @GetMapping("/brands")
    public ResponseEntity<List<BrandEntity>> getAvailableBrandsForOnboarding() {
        List<BrandEntity> brands = brandRepository.findAll().stream()
                .filter(b -> !"DEACTIVATED".equalsIgnoreCase(b.getStatus()) && !"DELETED".equalsIgnoreCase(b.getStatus()))
                .toList();
        return ResponseEntity.ok(brands);
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(org.springframework.security.core.Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(authService.getCurrentUserProfile(authentication.getName()));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> googleLogin(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.googleLogin(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody AuthRequest request) {
        authService.forgotPassword(request.getEmail(), request.getPassword());
        return ResponseEntity.ok(Map.of("message", "Password updated and confirmation sent."));
    }

    @PostMapping("/feedback")
    public ResponseEntity<Map<String, String>> submitFeedback(@RequestBody Map<String, String> payload) {
        authService.submitFeedback(payload.get("email"), payload.get("message"));
        return ResponseEntity.ok(Map.of("message", "Your feedback/query has been sent to chaitanyamandviya7@gmail.com."));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleAuthException(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", ex.getMessage() != null ? ex.getMessage() : "Authentication failed"));
    }
}
