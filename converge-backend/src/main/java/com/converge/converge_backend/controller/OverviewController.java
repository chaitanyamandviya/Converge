package com.converge.converge_backend.controller;

import com.converge.converge_backend.config.CacheConfig;
import com.converge.converge_backend.dto.OverviewDto;
import com.converge.converge_backend.entity.AgencyEntity;
import com.converge.converge_backend.entity.BrandEntity;
import com.converge.converge_backend.entity.CampaignEntity;
import com.converge.converge_backend.entity.ContentItemEntity;
import com.converge.converge_backend.entity.CreatorEntity;
import com.converge.converge_backend.entity.UserEntity;
import com.converge.converge_backend.repository.AgencyRepository;
import com.converge.converge_backend.repository.BrandRepository;
import com.converge.converge_backend.repository.CampaignRepository;
import com.converge.converge_backend.repository.ContentItemRepository;
import com.converge.converge_backend.repository.CreatorRepository;
import com.converge.converge_backend.repository.UserRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/overview")
public class OverviewController {

    private final CampaignRepository campaignRepository;
    private final BrandRepository brandRepository;
    private final AgencyRepository agencyRepository;
    private final CreatorRepository creatorRepository;
    private final ContentItemRepository contentItemRepository;
    private final UserRepository userRepository;

    public OverviewController(
            CampaignRepository campaignRepository,
            BrandRepository brandRepository,
            AgencyRepository agencyRepository,
            CreatorRepository creatorRepository,
            ContentItemRepository contentItemRepository,
            UserRepository userRepository
    ) {
        this.campaignRepository = campaignRepository;
        this.brandRepository = brandRepository;
        this.agencyRepository = agencyRepository;
        this.creatorRepository = creatorRepository;
        this.contentItemRepository = contentItemRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    @Cacheable(value = CacheConfig.CACHE_OVERVIEW, key = "(#campaignId != null ? #campaignId : 'all') + '_' + (#authentication != null ? #authentication.name : 'anon')")
    public ResponseEntity<OverviewDto> getOverview(
            @RequestParam(required = false) Long campaignId,
            Authentication authentication
    ) {
        boolean isAgency = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_AGENCY_MANAGER".equalsIgnoreCase(a.getAuthority()));
        boolean isBrand = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_BRAND_MANAGER".equalsIgnoreCase(a.getAuthority()));

        Set<Long> deletedBrandIds = brandRepository.findAll().stream()
                .filter(b -> "DELETED".equalsIgnoreCase(b.getStatus()) && b.getId() != null)
                .map(BrandEntity::getId)
                .collect(Collectors.toSet());

        Set<String> deletedAgencyNames = agencyRepository.findAll().stream()
                .filter(a -> "DELETED".equalsIgnoreCase(a.getStatus())
                        || (a.getBrandId() != null && deletedBrandIds.contains(a.getBrandId())))
                .map(a -> a.getName() != null ? a.getName().trim().toLowerCase() : "")
                .filter(n -> !n.isEmpty())
                .collect(Collectors.toSet());

        List<CampaignEntity> allCampaigns = campaignRepository.findAll().stream()
                .filter(c -> !"DELETED".equalsIgnoreCase(c.getStatus()))
                .toList();

        CampaignEntity selectedCampaign = null;
        if (campaignId != null) {
            selectedCampaign = allCampaigns.stream()
                    .filter(c -> c.getId().equals(campaignId))
                    .findFirst()
                    .orElse(null);
        }

        List<AgencyEntity> agencies = agencyRepository.findAll().stream()
                .filter(a -> !"DELETED".equalsIgnoreCase(a.getStatus()))
                .filter(a -> a.getBrandId() == null || !deletedBrandIds.contains(a.getBrandId()))
                .toList();

        List<CreatorEntity> creators = creatorRepository.findAll().stream()
                .filter(c -> c.getAgencyName() == null || !deletedAgencyNames.contains(c.getAgencyName().trim().toLowerCase()))
                .toList();

        List<ContentItemEntity> contents = contentItemRepository.findAll().stream()
                .filter(c -> c.getAgencyName() == null || !deletedAgencyNames.contains(c.getAgencyName().trim().toLowerCase()))
                .toList();

        String callerAgencyName = null;
        String callerBrandName = null;

        if (isBrand && authentication != null) {
            UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
            if (caller != null) {
                Long callerBrandId = caller.getBrandId();
                callerBrandName = caller.getOrganizationName();
                if ((callerBrandName == null || callerBrandName.isBlank()) && callerBrandId != null) {
                    callerBrandName = brandRepository.findById(callerBrandId).map(BrandEntity::getName).orElse(null);
                }
                final Long finalBrandId = callerBrandId;
                final String finalBrandName = callerBrandName;

                agencies = agencies.stream()
                        .filter(a -> (finalBrandId != null && finalBrandId.equals(a.getBrandId()))
                                || (finalBrandName != null && a.getBrandName() != null && finalBrandName.equalsIgnoreCase(a.getBrandName().trim())))
                        .toList();

                Set<String> brandAgencyNames = agencies.stream()
                        .map(a -> a.getName() != null ? a.getName().trim().toLowerCase() : "")
                        .filter(n -> !n.isEmpty())
                        .collect(Collectors.toSet());

                contents = contents.stream()
                        .filter(c -> (c.getAgencyName() != null && brandAgencyNames.contains(c.getAgencyName().trim().toLowerCase()))
                                || (finalBrandName != null && c.getAgencyName() != null && finalBrandName.equalsIgnoreCase(c.getAgencyName().trim())))
                        .toList();

                Set<String> brandCreatorHandles = contents.stream()
                        .map(ContentItemEntity::getCreatorHandle)
                        .filter(Objects::nonNull)
                        .map(h -> h.trim().toLowerCase())
                        .collect(Collectors.toSet());

                creators = creators.stream()
                        .filter(c -> (c.getAgencyName() != null && brandAgencyNames.contains(c.getAgencyName().trim().toLowerCase()))
                                || (c.getHandle() != null && brandCreatorHandles.contains(c.getHandle().trim().toLowerCase()))
                                || (finalBrandId != null && finalBrandId.equals(c.getBrandId()))
                                || (finalBrandName != null && c.getBrandName() != null && finalBrandName.equalsIgnoreCase(c.getBrandName().trim()))
                                || (finalBrandName != null && c.getAgencyName() != null && finalBrandName.equalsIgnoreCase(c.getAgencyName().trim())))
                        .toList();

                if (finalBrandName != null) {
                    allCampaigns = allCampaigns.stream()
                            .filter(c -> finalBrandName.equalsIgnoreCase(c.getBrandName()))
                            .toList();
                }
            }
        }

        if (isAgency && authentication != null) {
            UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
            if (caller != null) {
                if (caller.getAgencyId() != null) {
                    AgencyEntity a = agencyRepository.findById(caller.getAgencyId()).orElse(null);
                    if (a != null && a.getName() != null) callerAgencyName = a.getName().trim();
                }
                if (callerAgencyName == null && caller.getOrganizationName() != null && !caller.getOrganizationName().isBlank()) {
                    callerAgencyName = caller.getOrganizationName().trim();
                }
                if (callerAgencyName == null) {
                    AgencyEntity a = agencyRepository.findAll().stream()
                            .filter(ag -> ag.getContactEmail() != null && ag.getContactEmail().trim().equalsIgnoreCase(caller.getEmail()))
                            .findFirst().orElse(null);
                    if (a != null && a.getName() != null) callerAgencyName = a.getName().trim();
                }
            }
        }

        if (selectedCampaign != null) {
            final Long targetCampId = selectedCampaign.getId();
            final String targetCampName = selectedCampaign.getName();
            List<ContentItemEntity> matchedItems = contents.stream()
                    .filter(i -> (i.getCampaignId() != null && i.getCampaignId().equals(targetCampId))
                            || (i.getCampaignName() != null && i.getCampaignName().equalsIgnoreCase(targetCampName)))
                    .toList();
            // If items haven't been tagged to campaign yet and this is the sole/first campaign, show items
            if (!matchedItems.isEmpty() || allCampaigns.size() == 1) {
                if (!matchedItems.isEmpty()) contents = matchedItems;
            }
            Set<String> matchedHandles = contents.stream().map(ContentItemEntity::getCreatorHandle).filter(Objects::nonNull).map(String::toLowerCase).collect(Collectors.toSet());
            if (!matchedHandles.isEmpty()) {
                creators = creators.stream().filter(c -> c.getHandle() != null && matchedHandles.contains(c.getHandle().toLowerCase())).toList();
            }
        }

        double totalSpend = 0.0;
        if (isAgency && callerAgencyName != null) {
            final String finalAgency = callerAgencyName;
            agencies = agencies.stream()
                    .filter(a -> finalAgency.equalsIgnoreCase(a.getName()))
                    .toList();

            AgencyEntity myAg = agencies.stream().findFirst().orElse(null);
            String agBrand = myAg != null ? myAg.getBrandName() : null;

            List<ContentItemEntity> agencyContents = contents.stream()
                    .filter(c -> c.getAgencyName() != null && finalAgency.equalsIgnoreCase(c.getAgencyName().trim()))
                    .toList();
            contents = agencyContents;

            allCampaigns = allCampaigns.stream()
                    .filter(c -> (c.getAssignedAgencyNames() != null && c.getAssignedAgencyNames().toLowerCase().contains(finalAgency.toLowerCase()))
                            || (agBrand != null && agBrand.equalsIgnoreCase(c.getBrandName()))
                            || agencyContents.stream().anyMatch(i -> (i.getCampaignId() != null && i.getCampaignId().equals(c.getId()))))
                    .toList();

            Set<String> agencyCreatorHandles = agencyContents.stream()
                    .map(ContentItemEntity::getCreatorHandle)
                    .filter(h -> h != null && !h.isBlank())
                    .map(h -> h.trim().toLowerCase())
                    .collect(Collectors.toSet());

            creators = creators.stream()
                    .filter(c -> (c.getAgencyName() != null && finalAgency.equalsIgnoreCase(c.getAgencyName().trim()))
                            || (c.getHandle() != null && agencyCreatorHandles.contains(c.getHandle().trim().toLowerCase())))
                    .toList();

            double agencySpend = agencyContents.stream().mapToDouble(ContentItemEntity::getFinalPrice).sum();
            if (agencySpend == 0.0) {
                if (myAg != null) agencySpend = myAg.getAgreedSpend();
            }
            totalSpend = agencySpend;
        } else if (!isAgency) {
            if (selectedCampaign != null) {
                double budget = selectedCampaign.getTotalAgreedSpend();
                double itemSpend = contents.stream().mapToDouble(ContentItemEntity::getFinalPrice).sum();
                totalSpend = budget > 0 ? budget : itemSpend;
            } else {
                double totalCampaignsBudget = allCampaigns.stream().mapToDouble(CampaignEntity::getTotalAgreedSpend).sum();
                double agencySpend = agencies.stream().mapToDouble(AgencyEntity::getAgreedSpend).sum();
                double creatorSpend = creators.stream().mapToDouble(CreatorEntity::getPrice).sum();
                totalSpend = Math.max(totalCampaignsBudget, agencySpend + creatorSpend);
            }
        }

        long contentViews = contents.stream().mapToLong(ContentItemEntity::getViews).sum();
        long creatorViews = creators.stream().mapToLong(CreatorEntity::getViews).sum();
        long totalViews = Math.max(contentViews, creatorViews);

        long contentLikes = contents.stream().mapToLong(ContentItemEntity::getLikes).sum();
        long creatorLikes = creators.stream().mapToLong(CreatorEntity::getLikes).sum();
        long totalLikes = Math.max(contentLikes, creatorLikes);

        long contentComments = contents.stream().mapToLong(ContentItemEntity::getComments).sum();
        long creatorComments = creators.stream().mapToLong(CreatorEntity::getComments).sum();
        long totalComments = Math.max(contentComments, creatorComments);

        int totalContent = contents.size();
        int withInsights = (int) contents.stream().filter(c -> "WITH_INSIGHTS".equalsIgnoreCase(c.getStatus())).count();
        int missingUrls = (int) contents.stream().filter(c -> "MISSING_URL".equalsIgnoreCase(c.getStatus())).count();
        int awaitingInsights = (int) contents.stream().filter(c -> "AWAITING_INSIGHTS".equalsIgnoreCase(c.getStatus())).count();
        int coveragePct = totalContent > 0 ? Math.round((withInsights * 100.0f) / totalContent) : 0;

        String campaignTitle;
        String timeframe;
        if (isAgency) {
            campaignTitle = callerAgencyName != null ? callerAgencyName : "Agency Workspace";
            timeframe = "—";
        } else if (selectedCampaign != null) {
            campaignTitle = selectedCampaign.getName();
            timeframe = selectedCampaign.getTimeframe();
        } else if (!allCampaigns.isEmpty()) {
            campaignTitle = "Consolidated Portfolio";
            timeframe = allCampaigns.size() + (allCampaigns.size() == 1 ? " Campaign Active" : " Campaigns Active");
        } else {
            campaignTitle = "No Active Campaign";
            timeframe = "—";
        }

        OverviewDto dto = OverviewDto.builder()
                .campaignName(campaignTitle)
                .activeCampaignId(selectedCampaign != null ? selectedCampaign.getId() : null)
                .brandName(selectedCampaign != null && selectedCampaign.getBrandName() != null ? selectedCampaign.getBrandName() : (callerBrandName != null ? callerBrandName : "Brand Workspace"))
                .timeframe(timeframe)
                .agenciesCount(isAgency ? 1 : agencies.size())
                .creatorsCount(creators.size())
                .contentRatio(withInsights + " / " + totalContent)
                .totalAgreedSpend(totalSpend)
                .views(totalViews)
                .likes(totalLikes)
                .comments(totalComments)
                .missingUrlsCount(missingUrls)
                .awaitingInsightsCount(awaitingInsights)
                .coveragePercent(coveragePct)
                .campaigns(allCampaigns)
                .weeklyTrends(List.of())
                .build();

        return ResponseEntity.ok(dto);
    }

    @PostMapping("/campaign")
    public ResponseEntity<CampaignEntity> createCampaign(@RequestBody CampaignEntity payload) {
        CampaignEntity campaign = new CampaignEntity();
        campaign.setName(payload.getName() != null && !payload.getName().isBlank() ? payload.getName().trim() : "New Campaign");
        campaign.setBrandName(payload.getBrandName() != null ? payload.getBrandName() : "Brand Workspace");
        campaign.setStatus("ACTIVE");
        campaign.setTimeframe(payload.getTimeframe() != null ? payload.getTimeframe() : "Current Quarter");
        campaign.setTotalAgreedSpend(Math.max(0.0, payload.getTotalAgreedSpend()));
        campaign.setTotalViews(0L);
        campaign.setTotalLikes(0L);
        campaign.setTotalComments(0L);
        campaign.setTotalAgencies((int) agencyRepository.count());
        campaign.setTotalCreators((int) creatorRepository.count());
        campaign.setContentWithInsights("0 / 0");
        return ResponseEntity.ok(campaignRepository.save(campaign));
    }
}
