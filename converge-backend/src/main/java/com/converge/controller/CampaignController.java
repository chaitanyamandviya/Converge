package com.converge.controller;

import com.converge.entity.CampaignCreator;
import com.converge.service.CampaignService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class CampaignController {

    private final CampaignService campaignService;

    public CampaignController(CampaignService campaignService) {
        this.campaignService = campaignService;
    }

    @GetMapping("/brands/{brandId}/campaigns")
    public List<Map<String, Object>> list(@PathVariable UUID brandId, Authentication auth) {
        return campaignService.listCampaigns(brandId, auth);
    }

    @PostMapping("/brands/{brandId}/campaigns")
    public Map<String, Object> create(
            @PathVariable UUID brandId,
            @RequestBody Map<String, Object> payload,
            Authentication auth) {
        return campaignService.createCampaign(brandId, payload, auth);
    }

    @GetMapping("/campaigns/{campaignId}")
    public Map<String, Object> detail(@PathVariable UUID campaignId, Authentication auth) {
        return campaignService.getCampaignDetail(campaignId, auth);
    }

    @PatchMapping("/campaigns/{campaignId}")
    public Map<String, Object> update(
            @PathVariable UUID campaignId,
            @RequestBody Map<String, Object> payload,
            Authentication auth) {
        return campaignService.updateCampaign(campaignId, payload, auth);
    }

    @DeleteMapping("/campaigns/{campaignId}")
    public Map<String, Object> delete(@PathVariable UUID campaignId, Authentication auth) {
        campaignService.deleteCampaign(campaignId, auth);
        return Map.of("deleted", true);
    }

    @PostMapping("/campaigns/{campaignId}/creators")
    public CampaignCreator assignCreator(
            @PathVariable UUID campaignId,
            @RequestBody Map<String, Object> payload,
            Authentication auth) {
        return campaignService.assignCreatorToCampaign(campaignId, payload, auth);
    }

    @DeleteMapping("/campaigns/{campaignId}/creators/{creatorId}")
    public Map<String, Object> removeCreator(
            @PathVariable UUID campaignId,
            @PathVariable UUID creatorId,
            Authentication auth) {
        campaignService.removeCreatorFromCampaign(campaignId, creatorId, auth);
        return Map.of("removed", true);
    }
}
