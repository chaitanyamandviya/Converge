package com.converge.controller;

import com.converge.service.BrandService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/public/reports")
public class PublicReportController {

    private final BrandService brandService;

    public PublicReportController(BrandService brandService) {
        this.brandService = brandService;
    }

    @GetMapping("/{token}")
    public ResponseEntity<Map<String, Object>> viewReport(@PathVariable String token) {
        Map<String, Object> payload = brandService.getPublicSharedReport(token);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(payload);
    }
}
