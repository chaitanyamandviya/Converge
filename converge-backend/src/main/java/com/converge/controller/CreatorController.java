package com.converge.controller;

import com.converge.entity.ReelDeliverable;
import com.converge.service.BrandService;
import com.converge.service.InstagramGraphService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/creators")
public class CreatorController {

    private final BrandService brandService;
    private final InstagramGraphService instagramGraphService;

    public CreatorController(BrandService brandService, InstagramGraphService instagramGraphService) {
        this.brandService = brandService;
        this.instagramGraphService = instagramGraphService;
    }

    @GetMapping("/lookup")
    public Map<String, Object> lookupProfile(@RequestParam String handle, Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Authentication required.");
        }
        return instagramGraphService.fetchCreatorProfile(handle);
    }

    @GetMapping("/{creatorId}/insights")
    public Map<String, Object> creatorInsights(@PathVariable UUID creatorId, Authentication auth) {
        brandService.requireCreatorAccess(creatorId, auth);
        return brandService.getCreatorInsights(creatorId, brandService.isAdmin(auth), auth != null ? auth.getName() : null);
    }

    @PutMapping("/{creatorId}/insights-profile")
    public Map<String, Object> updateCreatorInsightsProfile(
            @PathVariable UUID creatorId,
            @RequestBody Map<String, Object> payload,
            Authentication auth) {
        brandService.requireCreatorManagementAccess(creatorId, auth);
        return brandService.updateCreatorInsightsProfile(
                creatorId,
                payload,
                brandService.isAdmin(auth),
                auth != null ? auth.getName() : null,
                brandService.resolveActor(auth, "Workspace Manager")
        );
    }

    @PostMapping("/{creatorId}/sync-instagram")
    public Map<String, Object> syncCreator(@PathVariable UUID creatorId, Authentication auth) {
        brandService.requireCreatorManagementAccess(creatorId, auth);
        return brandService.syncCreatorFromInstagram(
                creatorId,
                brandService.isAdmin(auth),
                auth != null ? auth.getName() : null,
                brandService.resolveActor(auth, "Workspace Manager")
        );
    }

    @DeleteMapping("/{creatorId}")
    public Map<String, Object> deleteCreator(@PathVariable UUID creatorId, Authentication auth) {
        brandService.requireCreatorAccess(creatorId, auth);
        brandService.deleteCreator(creatorId, brandService.resolveActor(auth, "Workspace Manager"));
        return Map.of("deleted", true);
    }

    @GetMapping("/{creatorId}/deliverables")
    public List<ReelDeliverable> deliverables(@PathVariable UUID creatorId, Authentication auth) {
        brandService.requireCreatorAccess(creatorId, auth);
        return brandService.listCreatorDeliverables(creatorId);
    }

    @PostMapping("/{creatorId}/deliverables")
    public ReelDeliverable addDeliverable(
            @PathVariable UUID creatorId,
            @RequestBody Map<String, String> payload,
            Authentication auth) {
        brandService.requireCreatorManagementAccess(creatorId, auth);
        return brandService.addReelDeliverable(creatorId, payload, brandService.resolveActor(auth, "Brand Manager"));
    }

    @DeleteMapping("/deliverables/{deliverableId}")
    public Map<String, Object> deleteDeliverable(@PathVariable UUID deliverableId, Authentication auth) {
        brandService.requireDeliverableAccess(deliverableId, auth);
        brandService.deleteDeliverable(deliverableId);
        return Map.of("deleted", true);
    }

    @PutMapping("/deliverables/{deliverableId}")
    public ReelDeliverable updateDeliverable(
            @PathVariable UUID deliverableId,
            @RequestBody Map<String, Object> payload,
            Authentication auth) {
        brandService.requireDeliverableManagementAccess(deliverableId, auth);
        return brandService.updateDeliverable(deliverableId, payload, brandService.resolveActor(auth, "Workspace Manager"));
    }

    @GetMapping("/deliverables/{deliverableId}/insights")
    public Map<String, Object> deliverableInsights(@PathVariable UUID deliverableId, Authentication auth) {
        brandService.requireDeliverableAccess(deliverableId, auth);
        return brandService.getDeliverableInsights(deliverableId);
    }
}
