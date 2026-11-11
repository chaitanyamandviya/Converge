package com.converge.converge_backend.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Enterprise Health & Diagnostic Endpoint.
 * Actively monitors database availability, connection latency, and runtime JVM memory
 * to support load balancer probes, Kubernetes liveness/readiness, and Cloudflare status checks.
 */
@RestController
public class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);
    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping({"/", "/healthz", "/api/health"})
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "converge-backend");
        response.put("timestamp", Instant.now().toString());
        response.put("version", "0.0.1-SNAPSHOT");

        // 1. Database Connectivity & Ping Latency Check
        long dbStart = System.currentTimeMillis();
        boolean dbHealthy = false;
        long dbLatencyMs = -1;
        String dbMessage = "Connected";

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("SELECT 1");
            dbLatencyMs = System.currentTimeMillis() - dbStart;
            dbHealthy = true;
        } catch (Exception e) {
            dbLatencyMs = System.currentTimeMillis() - dbStart;
            dbMessage = "Database unreachable: " + e.getMessage();
            log.error("[HEALTH] Database health check failed: {}", e.getMessage());
        }

        Map<String, Object> dbDetails = new LinkedHashMap<>();
        dbDetails.put("status", dbHealthy ? "UP" : "DOWN");
        dbDetails.put("latencyMs", dbLatencyMs);
        dbDetails.put("message", dbMessage);
        response.put("database", dbDetails);

        // 2. Runtime JVM Memory & Uptime Diagnostics
        Runtime runtime = Runtime.getRuntime();
        long totalMemoryMb = runtime.totalMemory() / (1024 * 1024);
        long freeMemoryMb = runtime.freeMemory() / (1024 * 1024);
        long usedMemoryMb = totalMemoryMb - freeMemoryMb;
        long uptimeSeconds = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;

        Map<String, Object> jvmDetails = new LinkedHashMap<>();
        jvmDetails.put("uptimeSeconds", uptimeSeconds);
        jvmDetails.put("usedMemoryMb", usedMemoryMb);
        jvmDetails.put("freeMemoryMb", freeMemoryMb);
        jvmDetails.put("totalMemoryMb", totalMemoryMb);
        response.put("system", jvmDetails);

        response.put("status", dbHealthy ? "UP" : "DEGRADED");

        HttpStatus httpStatus = dbHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
        return ResponseEntity.status(httpStatus).body(response);
    }
}
