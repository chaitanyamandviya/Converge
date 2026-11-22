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
        return brandService.isAdmin(auth);
    }

    @GetMapping
    public List<Brand> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            Authentication auth) {
        return brandService.listBrandsForCaller(status, search, auth);
    }

    @PostMapping
    public ResponseEntity<?> provision(@RequestBody Map<String, String> payload, Authentication auth) {
        if (!isAdmin(auth)) {
            return ResponseEntity.status(403).body(Map.of("error", "Only System Admin can provision brands."));
        }
        return ResponseEntity.ok(brandService.provisionBrand(payload, brandService.resolveActor(auth, "Admin")));
    }

    @GetMapping("/{id}")
    public Map<String, Object> overview(@PathVariable UUID id, Authentication auth) {
        brandService.requireBrandAccess(id, auth);
        return brandService.getBrandOverview(id, auth);
    }

    @PatchMapping("/{id}")
    public Brand update(@PathVariable UUID id, @RequestBody Map<String, String> payload, Authentication auth) {
        brandService.requireAdmin(auth);
        return brandService.updateBrand(id, payload, brandService.resolveActor(auth, "Admin"));
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
    public List<Agency> agencies(@PathVariable UUID id, Authentication auth) {
        brandService.requireBrandAccess(id, auth);
        return brandService.listAgencies(id, auth);
    }

    @PostMapping("/{id}/agencies")
    public Agency addAgency(@PathVariable UUID id, @RequestBody Map<String, String> payload, Authentication auth) {
        brandService.requireBrandOwnerAccess(id, auth);
        return brandService.addAgency(id, payload, brandService.resolveActor(auth, "Brand Manager"));
    }

    @PatchMapping("/{id}/agencies/{agencyId}")
    public Agency updateAgency(
            @PathVariable UUID id,
            @PathVariable UUID agencyId,
            @RequestBody Map<String, String> payload,
            Authentication auth) {
        brandService.requireBrandOwnerAccess(id, auth);
        return brandService.updateAgencyPermissions(id, agencyId, payload, brandService.resolveActor(auth, "Brand Owner"));
    }

    @DeleteMapping("/{id}/agencies/{agencyId}")
    public Map<String, Object> deleteAgency(
            @PathVariable UUID id,
            @PathVariable UUID agencyId,
            Authentication auth) {
        brandService.requireBrandOwnerAccess(id, auth);
        brandService.deleteAgency(id, agencyId, brandService.resolveActor(auth, "Brand Manager"));
        return Map.of("deleted", true);
    }

    @GetMapping("/{id}/creators")
    public List<Creator> creators(
            @PathVariable UUID id,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String agency,
            @RequestParam(required = false) String search,
            Authentication auth) {
        brandService.requireBrandAccess(id, auth);
        return brandService.listCreators(id, type, agency, search, auth);
    }

    @PostMapping("/{id}/creators")
    public Creator addCreator(@PathVariable UUID id, @RequestBody Map<String, String> payload, Authentication auth) {
        brandService.requireBrandAccess(id, auth);
        return brandService.addDirectCreator(id, payload, brandService.resolveActor(auth, "Brand Manager"));
    }

    @PostMapping("/{id}/sync")
    public Map<String, Object> sync(
            @PathVariable UUID id,
            @RequestParam(required = false) String source,
            Authentication auth) {
        brandService.requireBrandAccess(id, auth);
        if ("login".equalsIgnoreCase(source)) {
            return brandService.syncBrandDeliverablesOnLogin(id, brandService.resolveActor(auth, "Login Auto-Sync"), auth);
        }
        return brandService.syncBrandDeliverables(id, brandService.resolveActor(auth, "Workspace Manager"), auth);
    }

    @GetMapping("/{id}/audit-logs")
    public Map<String, Object> auditLogs(
            @PathVariable UUID id,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication auth) {
        brandService.requireBrandAccess(id, auth);
        return brandService.listAuditLogs(id, category, search, page, size, auth);
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<String> exportCsv(@PathVariable UUID id, Authentication auth) {
        brandService.requireBrandAccess(id, auth);
        String csv = brandService.exportBrandCsv(id, auth);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=converge-brand-report.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
