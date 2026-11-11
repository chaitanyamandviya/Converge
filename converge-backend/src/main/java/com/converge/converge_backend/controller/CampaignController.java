package com.converge.converge_backend.controller;

import com.converge.converge_backend.config.CacheConfig;
import com.converge.converge_backend.entity.AgencyEntity;
import com.converge.converge_backend.entity.BrandEntity;
import com.converge.converge_backend.entity.CampaignEntity;
import com.converge.converge_backend.entity.ContentItemEntity;
import com.converge.converge_backend.entity.UserEntity;
import com.converge.converge_backend.repository.AgencyRepository;
import com.converge.converge_backend.repository.BrandRepository;
import com.converge.converge_backend.repository.CampaignRepository;
import com.converge.converge_backend.repository.ContentItemRepository;
import com.converge.converge_backend.repository.CreatorRepository;
import com.converge.converge_backend.repository.UserRepository;
import com.converge.converge_backend.service.CacheEvictionService;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/campaigns")
public class CampaignController {

    private final CampaignRepository campaignRepository;
    private final ContentItemRepository contentItemRepository;
    private final AgencyRepository agencyRepository;
    private final CreatorRepository creatorRepository;
    private final UserRepository userRepository;
    private final BrandRepository brandRepository;
    private final CacheEvictionService cacheEvictionService;

    public CampaignController(
            CampaignRepository campaignRepository,
            ContentItemRepository contentItemRepository,
            AgencyRepository agencyRepository,
            CreatorRepository creatorRepository,
            UserRepository userRepository,
            BrandRepository brandRepository,
            CacheEvictionService cacheEvictionService
    ) {
        this.campaignRepository = campaignRepository;
        this.contentItemRepository = contentItemRepository;
        this.agencyRepository = agencyRepository;
        this.creatorRepository = creatorRepository;
        this.userRepository = userRepository;
        this.brandRepository = brandRepository;
        this.cacheEvictionService = cacheEvictionService;
    }

    private CampaignEntity enrichCampaign(CampaignEntity campaign, List<ContentItemEntity> allItems) {
        Long campId = campaign.getId();
        List<ContentItemEntity> campItems = allItems.stream()
                .filter(i -> (i.getCampaignId() != null && i.getCampaignId().equals(campId))
                        || (i.getCampaignName() != null && i.getCampaignName().equalsIgnoreCase(campaign.getName())))
                .toList();

        // If items are untagged, and this is the primary/first active campaign, count them
        if (campItems.isEmpty() && !allItems.isEmpty()) {
            boolean isOnlyOrFirst = campaignRepository.findAll().stream()
                    .filter(c -> !"DELETED".equalsIgnoreCase(c.getStatus()))
                    .findFirst()
                    .map(c -> c.getId().equals(campId))
                    .orElse(false);
            if (isOnlyOrFirst) {
                campItems = allItems;
            }
        }

        long views = campItems.stream().mapToLong(ContentItemEntity::getViews).sum();
        long likes = campItems.stream().mapToLong(ContentItemEntity::getLikes).sum();
        long comments = campItems.stream().mapToLong(ContentItemEntity::getComments).sum();
        long distinctCreators = campItems.stream().map(ContentItemEntity::getCreatorHandle).filter(Objects::nonNull).distinct().count();
        long distinctAgencies = campItems.stream().map(ContentItemEntity::getAgencyName).filter(Objects::nonNull).distinct().count();
        long withInsights = campItems.stream().filter(i -> "WITH_INSIGHTS".equalsIgnoreCase(i.getStatus())).count();

        campaign.setTotalViews(views);
        campaign.setTotalLikes(likes);
        campaign.setTotalComments(comments);
        campaign.setTotalCreators((int) distinctCreators);
        campaign.setTotalAgencies((int) distinctAgencies);
        campaign.setContentWithInsights(withInsights + " / " + campItems.size());
        return campaign;
    }

    @GetMapping
    @Cacheable(value = CacheConfig.CACHE_CAMPAIGNS, key = "#authentication != null ? #authentication.name : 'all'")
    public ResponseEntity<List<CampaignEntity>> getAllCampaigns(Authentication authentication) {
        List<ContentItemEntity> allItems = contentItemRepository.findAll();
        List<CampaignEntity> list = campaignRepository.findAll().stream()
                .filter(c -> !"DELETED".equalsIgnoreCase(c.getStatus()))
                .map(c -> enrichCampaign(c, allItems))
                .toList();

        if (authentication != null && authentication.getName() != null) {
            UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
            if (caller != null && "BRAND_MANAGER".equalsIgnoreCase(caller.getRole())) {
                String brandName = caller.getOrganizationName();
                if ((brandName == null || brandName.isBlank()) && caller.getBrandId() != null) {
                    brandName = brandRepository.findById(caller.getBrandId()).map(BrandEntity::getName).orElse(null);
                }
                if (brandName != null && !brandName.isBlank()) {
                    final String bName = brandName.trim();
                    list = list.stream()
                            .filter(c -> c.getBrandName() != null && bName.equalsIgnoreCase(c.getBrandName().trim()))
                            .toList();
                }
            } else if (caller != null && "AGENCY_MANAGER".equalsIgnoreCase(caller.getRole())) {
                String agencyName = caller.getOrganizationName();
                String brandName = null;
                if (caller.getAgencyId() != null) {
                    AgencyEntity ag = agencyRepository.findById(caller.getAgencyId()).orElse(null);
                    if (ag != null) {
                        if (ag.getName() != null) agencyName = ag.getName();
                        if (ag.getBrandName() != null) brandName = ag.getBrandName();
                    }
                }
                if (brandName == null && caller.getBrandId() != null) {
                    brandName = brandRepository.findById(caller.getBrandId()).map(BrandEntity::getName).orElse(null);
                }
                final String finalAgency = agencyName != null ? agencyName.trim() : null;
                final String finalBrand = brandName != null ? brandName.trim() : null;
                list = list.stream()
                        .filter(c -> (finalBrand != null && c.getBrandName() != null && finalBrand.equalsIgnoreCase(c.getBrandName().trim()))
                                || (finalAgency != null && c.getAssignedAgencyNames() != null && c.getAssignedAgencyNames().toLowerCase().contains(finalAgency.toLowerCase()))
                                || (finalAgency != null && allItems.stream().anyMatch(i -> (i.getCampaignId() != null && i.getCampaignId().equals(c.getId())) && i.getAgencyName() != null && i.getAgencyName().equalsIgnoreCase(finalAgency))))
                        .toList();
            }
        }
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    @Cacheable(value = CacheConfig.CACHE_CAMPAIGNS, key = "'detail-' + #id")
    public ResponseEntity<Map<String, Object>> getCampaignDetail(@PathVariable Long id) {
        CampaignEntity campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found with ID: " + id));

        List<ContentItemEntity> allItems = contentItemRepository.findAll();
        enrichCampaign(campaign, allItems);

        List<ContentItemEntity> campItems = allItems.stream()
                .filter(i -> (i.getCampaignId() != null && i.getCampaignId().equals(id))
                        || (i.getCampaignName() != null && i.getCampaignName().equalsIgnoreCase(campaign.getName())))
                .toList();

        Map<String, Object> resp = new HashMap<>();
        resp.put("campaign", campaign);
        resp.put("contentItems", campItems);
        return ResponseEntity.ok(resp);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER')")
    public ResponseEntity<CampaignEntity> createCampaign(@RequestBody CampaignEntity campaign, Authentication authentication) {
        if (campaign.getName() == null || campaign.getName().isBlank()) {
            campaign.setName("New Campaign");
        }
        if (authentication != null && authentication.getName() != null) {
            UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
            if (caller != null && "BRAND_MANAGER".equalsIgnoreCase(caller.getRole())) {
                String brandName = caller.getOrganizationName();
                if ((brandName == null || brandName.isBlank()) && caller.getBrandId() != null) {
                    brandName = brandRepository.findById(caller.getBrandId()).map(BrandEntity::getName).orElse(null);
                }
                if (brandName != null && !brandName.isBlank()) {
                    campaign.setBrandName(brandName.trim());
                }
            }
        }
        if (campaign.getBrandName() == null || campaign.getBrandName().isBlank()) {
            campaign.setBrandName("Brand Workspace");
        }
        if (campaign.getStatus() == null) campaign.setStatus("ACTIVE");
        if (campaign.getTimeframe() == null || campaign.getTimeframe().isBlank()) {
            campaign.setTimeframe("Current Quarter");
        }
        if (campaign.getContentWithInsights() == null) campaign.setContentWithInsights("0 / 0");
        CampaignEntity saved = campaignRepository.save(campaign);
        cacheEvictionService.evictCampaigns();
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER')")
    public ResponseEntity<CampaignEntity> updateCampaign(@PathVariable Long id, @RequestBody CampaignEntity payload) {
        CampaignEntity campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found with ID: " + id));

        if (payload.getName() != null && !payload.getName().isBlank()) campaign.setName(payload.getName().trim());
        if (payload.getTimeframe() != null && !payload.getTimeframe().isBlank()) campaign.setTimeframe(payload.getTimeframe().trim());
        if (payload.getTotalAgreedSpend() >= 0) campaign.setTotalAgreedSpend(payload.getTotalAgreedSpend());
        if (payload.getStatus() != null && !payload.getStatus().isBlank()) campaign.setStatus(payload.getStatus().trim());
        if (payload.getAssignedAgencyNames() != null) campaign.setAssignedAgencyNames(payload.getAssignedAgencyNames().trim());

        CampaignEntity saved = campaignRepository.save(campaign);
        cacheEvictionService.evictCampaigns();
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER')")
    public ResponseEntity<Map<String, String>> deleteCampaign(@PathVariable Long id) {
        CampaignEntity campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found with ID: " + id));

        // Unlink content items and creators from this deleted campaign
        List<ContentItemEntity> items = contentItemRepository.findAll().stream()
                .filter(ci -> id.equals(ci.getCampaignId()) || (campaign.getName() != null && campaign.getName().equalsIgnoreCase(ci.getCampaignName())))
                .toList();
        for (ContentItemEntity ci : items) {
            ci.setCampaignId(null);
            ci.setCampaignName(null);
            contentItemRepository.save(ci);
        }

        List<com.converge.converge_backend.entity.CreatorEntity> creators = creatorRepository.findAll().stream()
                .filter(c -> id.equals(c.getCampaignId()) || (campaign.getName() != null && campaign.getName().equalsIgnoreCase(c.getCampaignName())))
                .toList();
        for (com.converge.converge_backend.entity.CreatorEntity c : creators) {
            c.setCampaignId(null);
            c.setCampaignName(null);
            creatorRepository.save(c);
        }

        campaignRepository.delete(campaign);
        cacheEvictionService.evictAll();
        return ResponseEntity.ok(Map.of("message", "Campaign '" + campaign.getName() + "' permanently deleted successfully"));
    }
}
