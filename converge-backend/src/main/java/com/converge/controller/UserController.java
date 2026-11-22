package com.converge.controller;

import com.converge.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/search")
    public List<Map<String, Object>> searchByEmail(
            @RequestParam(defaultValue = "") String email,
            Authentication auth) {
        boolean isAdmin = auth != null && auth.isAuthenticated() && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SYSTEM_ADMIN".equals(a.getAuthority()));
        if (!isAdmin) {
            throw new AccessDeniedException("Only System Admin can search workspace users.");
        }
        String trimmed = email != null ? email.trim() : "";
        if (trimmed.length() < 2) {
            return List.of();
        }
        return userRepository
                .findByEmailContainingIgnoreCaseAndRoleNotIgnoreCase(trimmed, "SYSTEM_ADMIN", PageRequest.of(0, 5))
                .stream()
                .map(u -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", u.getId() != null ? u.getId().toString() : "");
                    row.put("name", u.getName() != null ? u.getName() : "");
                    row.put("email", u.getEmail() != null ? u.getEmail() : "");
                    row.put("role", u.getRole() != null ? u.getRole() : "BRAND_MANAGER");
                    row.put("verified", u.isVerified());
                    row.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : "");
                    return row;
                })
                .toList();
    }
}
