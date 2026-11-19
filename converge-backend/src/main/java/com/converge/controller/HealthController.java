package com.converge.controller;

import com.converge.service.InstagramGraphService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final InstagramGraphService instagramGraphService;

    public HealthController(InstagramGraphService instagramGraphService) {
        this.instagramGraphService = instagramGraphService;
    }

    @GetMapping
    public Map<String, Object> health() {
        boolean igConfigured = instagramGraphService.isBusinessDiscoveryConfigured();
        return Map.of(
                "status", "UP",
                "metaGraphApi", igConfigured ? "CONFIGURED" : "PENDING_CREDENTIALS",
                "instagramConfigured", igConfigured,
                "timestamp", Instant.now().toString()
        );
    }
}
