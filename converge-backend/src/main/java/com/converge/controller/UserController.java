package com.converge.controller;

import com.converge.repository.UserRepository;
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
    public List<Map<String, Object>> searchByEmail(@RequestParam(defaultValue = "") String email) {
        if (email.isBlank()) return List.of();
        return userRepository.findByEmailContainingIgnoreCase(email.trim()).stream()
                .filter(u -> !"SYSTEM_ADMIN".equalsIgnoreCase(u.getRole()))
                .limit(5)
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
