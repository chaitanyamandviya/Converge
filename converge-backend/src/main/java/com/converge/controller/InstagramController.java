package com.converge.controller;

import com.converge.entity.Creator;
import com.converge.entity.ReelDeliverable;
import com.converge.repository.CreatorRepository;
import com.converge.service.BrandService;
import com.converge.service.InstagramGraphService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/instagram")
public class InstagramController {

    private final InstagramGraphService instagramGraphService;
    private final BrandService brandService;
    private final CreatorRepository creatorRepository;

    public InstagramController(
            InstagramGraphService instagramGraphService,
            BrandService brandService,
            CreatorRepository creatorRepository) {
        this.instagramGraphService = instagramGraphService;
        this.brandService = brandService;
        this.creatorRepository = creatorRepository;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return instagramGraphService.getStatus();
    }

    @GetMapping("/profile")
    public Map<String, Object> fetchProfile(@RequestParam String handle) {
        return instagramGraphService.fetchCreatorProfile(handle);
    }

    @GetMapping("/media")
    public List<Map<String, Object>> fetchRecentMedia(
            @RequestParam(required = false) String handle,
            @RequestParam(required = false) UUID creatorId,
            @RequestParam(defaultValue = "12") int limit) {
        if (creatorId != null) {
            Creator c = creatorRepository.findById(creatorId)
                    .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
            String token = c.isIgConnected() ? c.getIgAccessToken() : null;
            return instagramGraphService.fetchRecentMedia(c.getHandle(), limit, token);
        }
        return instagramGraphService.fetchRecentMedia(handle, limit, null);
    }

    @PostMapping("/inspect-reel")
    public Map<String, Object> inspectReel(@RequestBody Map<String, String> payload) {
        String reelUrl = payload.getOrDefault("reelUrl", "");
        String creatorHandle = payload.getOrDefault("creatorHandle", "");
        return instagramGraphService.inspectPublicReel(reelUrl, creatorHandle);
    }

    @PostMapping("/creators/{creatorId}/sync")
    public Map<String, Object> syncCreator(@PathVariable UUID creatorId) {
        return brandService.syncCreatorFromInstagram(creatorId);
    }

    @PostMapping("/deliverables/{deliverableId}/sync")
    public ReelDeliverable syncDeliverable(@PathVariable UUID deliverableId) {
        return brandService.syncDeliverableFromInstagram(deliverableId);
    }

    @PostMapping("/brands/{brandId}/sync")
    public Map<String, Object> syncBrand(@PathVariable UUID brandId) {
        return brandService.syncBrandDeliverables(brandId);
    }

    @GetMapping("/oauth/authorize-url")
    public Map<String, Object> oauthAuthorizeUrl(@RequestParam(required = false) String state) {
        return instagramGraphService.buildOAuthAuthorizeUrl(state);
    }

    @PostMapping("/oauth/callback")
    public Map<String, Object> oauthCallback(@RequestBody Map<String, String> payload) {
        String code = payload.getOrDefault("code", "");
        String creatorIdRaw = payload.get("creatorId");
        Map<String, Object> oauthResult = instagramGraphService.exchangeCodeForLongLivedToken(code);

        if (creatorIdRaw != null && !creatorIdRaw.isBlank()) {
            UUID creatorId = UUID.fromString(creatorIdRaw);
            Creator updated = brandService.attachCreatorOAuthProfile(creatorId, oauthResult);
            return Map.of(
                    "connected", true,
                    "creator", updated
            );
        }

        return Map.of(
                "connected", true,
                "username", oauthResult.getOrDefault("username", ""),
                "name", oauthResult.getOrDefault("name", ""),
                "followersCount", oauthResult.getOrDefault("followersCount", 0L)
        );
    }
}
