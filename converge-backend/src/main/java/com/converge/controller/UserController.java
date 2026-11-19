package com.converge.controller;

import com.converge.repository.UserRepository;
import org.springframework.web.bind.annotation.*;

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
                .map(u -> Map.<String, Object>of(
                        "id", u.getId().toString(),
                        "name", u.getName(),
                        "email", u.getEmail(),
                        "role", u.getRole(),
                        "verified", u.isVerified(),
                        "createdAt", u.getCreatedAt().toString()
                ))
                .toList();
    }
}
