package com.converge.controller;

import com.converge.entity.Agency;
import com.converge.entity.Brand;
import com.converge.entity.Creator;
import com.converge.service.BrandService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/brands")
public class BrandController {

    private final BrandService brandService;

    public BrandController(BrandService brandService) {
        this.brandService = brandService;
    }

    private boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SYSTEM_ADMIN"));
    }

    @GetMapping
    public List<Brand> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            Authentication auth) {
        String managerEmailFilter = (!isAdmin(auth) && auth != null) ? auth.getName() : null;
        return brandService.listBrands(status, search, managerEmailFilter);
    }

    @PostMapping
    public ResponseEntity<?> provision(@RequestBody Map<String, String> payload, Authentication auth) {
        if (!isAdmin(auth)) {
            return ResponseEntity.status(403).body(Map.of("error", "Only System Admin can provision brands."));
        }
        return ResponseEntity.ok(brandService.provisionBrand(payload));
    }

    @GetMapping("/{id}")
    public Map<String, Object> overview(@PathVariable UUID id) {
        return brandService.getBrandOverview(id);
    }

    @PatchMapping("/{id}")
    public Brand update(@PathVariable UUID id, @RequestBody Map<String, String> payload) {
        return brandService.updateBrand(id, payload);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable UUID id, Authentication auth) {
        if (!isAdmin(auth)) {
            return ResponseEntity.status(403).body(Map.of("error", "Only System Admin can delete brands."));
        }
        brandService.deleteBrand(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @GetMapping("/{id}/agencies")
    public List<Agency> agencies(@PathVariable UUID id) {
        return brandService.listAgencies(id);
    }

    @PostMapping("/{id}/agencies")
    public Agency addAgency(@PathVariable UUID id, @RequestBody Map<String, String> payload) {
        return brandService.addAgency(id, payload);
    }

    @PatchMapping("/{id}/agencies/{agencyId}")
    public Agency updateAgency(
            @PathVariable UUID id,
            @PathVariable UUID agencyId,
            @RequestBody Map<String, String> payload) {
        return brandService.updateAgencyPermissions(id, agencyId, payload);
    }

    @GetMapping("/{id}/creators")
    public List<Creator> creators(
            @PathVariable UUID id,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String agency,
            @RequestParam(required = false) String search) {
        return brandService.listCreators(id, type, agency, search);
    }

    @PostMapping("/{id}/creators")
    public Creator addCreator(@PathVariable UUID id, @RequestBody Map<String, String> payload) {
        return brandService.addDirectCreator(id, payload);
    }

    @PostMapping("/{id}/sync")
    public Map<String, Object> sync(@PathVariable UUID id) {
        return brandService.syncBrandDeliverables(id);
    }

    @GetMapping("/{id}/audit-logs")
    public Map<String, Object> auditLogs(
            @PathVariable UUID id,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return brandService.listAuditLogs(id, category, search, page, size);
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<String> exportCsv(@PathVariable UUID id) {
        String csv = brandService.exportBrandCsv(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=converge-brand-report.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
