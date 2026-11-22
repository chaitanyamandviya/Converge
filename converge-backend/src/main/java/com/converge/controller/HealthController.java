package com.converge.controller;

import com.converge.service.InstagramGraphService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {

    private final InstagramGraphService instagramGraphService;
    private final DataSource dataSource;

    public HealthController(InstagramGraphService instagramGraphService, DataSource dataSource) {
        this.instagramGraphService = instagramGraphService;
        this.dataSource = dataSource;
    }

    @GetMapping("/")
    public Map<String, Object> root() {
        return Map.of(
                "service", "Converge API",
                "status", "UP",
                "health", "/api/health"
        );
    }

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        boolean igConfigured = instagramGraphService.isBusinessDiscoveryConfigured();
        boolean dbConnected = false;
        try (Connection conn = dataSource.getConnection()) {
            dbConnected = conn.isValid(3);
        } catch (Exception ignored) {
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", dbConnected ? "UP" : "DEGRADED");
        out.put("dbConnected", dbConnected);
        out.put("instagramConfigured", igConfigured);
        out.put("timestamp", Instant.now().toString());
        return out;
    }
}
