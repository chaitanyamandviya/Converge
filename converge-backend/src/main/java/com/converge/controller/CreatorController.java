package com.converge.controller;

import com.converge.entity.ReelDeliverable;
import com.converge.service.BrandService;
import com.converge.service.InstagramGraphService;
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
    public Map<String, Object> lookupProfile(@RequestParam String handle) {
        return instagramGraphService.fetchCreatorProfile(handle);
    }

    @GetMapping("/{creatorId}/insights")
    public Map<String, Object> creatorInsights(@PathVariable UUID creatorId) {
        return brandService.getCreatorInsights(creatorId);
    }

    @PutMapping("/{creatorId}/insights-profile")
    public Map<String, Object> updateCreatorInsightsProfile(
            @PathVariable UUID creatorId,
            @RequestBody Map<String, Object> payload) {
        return brandService.updateCreatorInsightsProfile(creatorId, payload);
    }

    @PostMapping("/{creatorId}/sync-instagram")
    public Map<String, Object> syncCreator(@PathVariable UUID creatorId) {
        return brandService.syncCreatorFromInstagram(creatorId);
    }

    @DeleteMapping("/{creatorId}")
    public Map<String, Object> deleteCreator(@PathVariable UUID creatorId) {
        brandService.deleteCreator(creatorId);
        return Map.of("deleted", true);
    }

    @GetMapping("/{creatorId}/deliverables")
    public List<ReelDeliverable> deliverables(@PathVariable UUID creatorId) {
        return brandService.listCreatorDeliverables(creatorId);
    }

    @PostMapping("/{creatorId}/deliverables")
    public ReelDeliverable addDeliverable(
            @PathVariable UUID creatorId,
            @RequestBody Map<String, String> payload) {
        return brandService.addReelDeliverable(creatorId, payload);
    }

    @DeleteMapping("/deliverables/{deliverableId}")
    public Map<String, Object> deleteDeliverable(@PathVariable UUID deliverableId) {
        brandService.deleteDeliverable(deliverableId);
        return Map.of("deleted", true);
    }

    @PutMapping("/deliverables/{deliverableId}")
    public ReelDeliverable updateDeliverable(
            @PathVariable UUID deliverableId,
            @RequestBody Map<String, Object> payload) {
        return brandService.updateDeliverable(deliverableId, payload);
    }

    @GetMapping("/deliverables/{deliverableId}/insights")
    public Map<String, Object> deliverableInsights(@PathVariable UUID deliverableId) {
        return brandService.getDeliverableInsights(deliverableId);
    }
}
