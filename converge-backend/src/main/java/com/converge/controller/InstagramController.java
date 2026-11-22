package com.converge.controller;

import com.converge.entity.Creator;
import com.converge.entity.ReelDeliverable;
import com.converge.security.JwtService;
import com.converge.service.BrandService;
import com.converge.service.InstagramGraphService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/instagram")
public class InstagramController {

    private final InstagramGraphService instagramGraphService;
    private final BrandService brandService;
    private final JwtService jwtService;

    public InstagramController(
            InstagramGraphService instagramGraphService,
            BrandService brandService,
            JwtService jwtService) {
        this.instagramGraphService = instagramGraphService;
        this.brandService = brandService;
        this.jwtService = jwtService;
    }

    private static void requireAuthenticated(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null || auth.getName().isBlank()) {
            throw new AccessDeniedException("Authentication required.");
        }
    }

    @GetMapping("/status")
    public Map<String, Object> status(Authentication auth) {
        requireAuthenticated(auth);
        return instagramGraphService.getStatus(brandService.isAdmin(auth));
    }

    @GetMapping("/profile")
    public Map<String, Object> fetchProfile(
            @RequestParam String handle,
            @RequestParam(defaultValue = "false") boolean refresh,
            Authentication auth) {
        requireAuthenticated(auth);
        return instagramGraphService.fetchCreatorProfile(handle, refresh);
    }

    @GetMapping("/media")
    public List<Map<String, Object>> fetchRecentMedia(
            @RequestParam(required = false) String handle,
            @RequestParam(required = false) UUID creatorId,
            @RequestParam(defaultValue = "100") int limit,
            Authentication auth) {
        requireAuthenticated(auth);
        if (creatorId != null) {
            Creator c = brandService.requireCreatorAccess(creatorId, auth);
            String token = c.isIgConnected() ? c.getIgAccessToken() : null;
            return instagramGraphService.fetchRecentMedia(c.getHandle(), limit, token);
        }
        return instagramGraphService.fetchRecentMedia(handle, limit, null);
    }

    @PostMapping("/inspect-reel")
    public Map<String, Object> inspectReel(@RequestBody Map<String, String> payload, Authentication auth) {
        requireAuthenticated(auth);
        String reelUrl = payload != null && payload.get("reelUrl") != null ? payload.get("reelUrl") : "";
        String creatorHandle = payload != null && payload.get("creatorHandle") != null ? payload.get("creatorHandle") : "";
        return instagramGraphService.inspectPublicReel(reelUrl, creatorHandle);
    }

    @PostMapping("/creators/{creatorId}/sync")
    public Map<String, Object> syncCreator(@PathVariable UUID creatorId, Authentication auth) {
        brandService.requireCreatorManagementAccess(creatorId, auth);
        return brandService.syncCreatorFromInstagram(
                creatorId,
                brandService.isAdmin(auth),
                auth != null ? auth.getName() : null,
                brandService.resolveActor(auth, "Workspace Manager")
        );
    }

    @PostMapping("/deliverables/{deliverableId}/sync")
    public ReelDeliverable syncDeliverable(@PathVariable UUID deliverableId, Authentication auth) {
        brandService.requireDeliverableManagementAccess(deliverableId, auth);
        return brandService.syncDeliverableFromInstagram(deliverableId);
    }

    @PostMapping("/brands/{brandId}/sync")
    public Map<String, Object> syncBrand(@PathVariable UUID brandId, Authentication auth) {
        brandService.requireBrandAccess(brandId, auth);
        return brandService.syncBrandDeliverables(brandId, brandService.resolveActor(auth, "Workspace Manager"), auth);
    }

    @GetMapping("/oauth/authorize-url")
    public Map<String, Object> oauthAuthorizeUrl(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String creatorId,
            Authentication auth) {
        requireAuthenticated(auth);
        String targetRaw = (creatorId != null && !creatorId.isBlank()) ? creatorId.trim() : (state != null ? state.trim() : "");
        if (targetRaw.isEmpty()) {
            throw new IllegalArgumentException("Valid creatorId is required to generate an Instagram connect link.");
        }
        UUID parsedCreatorId;
        try {
            parsedCreatorId = UUID.fromString(targetRaw);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid creatorId parameter.");
        }
        brandService.requireCreatorManagementAccess(parsedCreatorId, auth);
        String signedState = jwtService.generateInstagramOAuthState(parsedCreatorId, auth.getName());
        return instagramGraphService.buildOAuthAuthorizeUrl(signedState);
    }

    @PostMapping("/oauth/callback")
    public Map<String, Object> oauthCallback(
            @RequestBody(required = false) Map<String, String> payload,
            Authentication auth) {
        requireAuthenticated(auth);
        String code = payload != null && payload.get("code") != null ? payload.get("code").trim() : "";
        String stateToken = payload != null && payload.get("state") != null ? payload.get("state").trim() : "";
        String legacyCreatorParam = payload != null && payload.get("creatorId") != null ? payload.get("creatorId").trim() : "";
        if (stateToken.isEmpty() && !legacyCreatorParam.isEmpty()) {
            stateToken = legacyCreatorParam;
        }

        UUID verifiedCreatorId = jwtService.parseInstagramOAuthState(
                stateToken,
                auth.getName(),
                brandService.isAdmin(auth)
        );
        brandService.requireCreatorManagementAccess(verifiedCreatorId, auth);

        Map<String, Object> oauthResult = instagramGraphService.exchangeCodeForLongLivedToken(code);
        Creator updated = brandService.attachCreatorOAuthProfile(verifiedCreatorId, oauthResult);
        return Map.of(
                "connected", true,
                "creator", updated
        );
    }
}
