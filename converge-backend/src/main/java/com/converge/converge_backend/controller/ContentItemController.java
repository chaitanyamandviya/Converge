package com.converge.converge_backend.controller;

import com.converge.converge_backend.config.CacheConfig;
import com.converge.converge_backend.dto.AddContentRequest;
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
import com.converge.converge_backend.service.CacheEvictionService;
import com.converge.converge_backend.service.InstagramService;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/content")
public class ContentItemController {

    private final ContentItemRepository contentItemRepository;
    private final CreatorRepository creatorRepository;
    private final AgencyRepository agencyRepository;
    private final BrandRepository brandRepository;
    private final CampaignRepository campaignRepository;
    private final UserRepository userRepository;
    private final InstagramService instagramService;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    private final CacheEvictionService cacheEvictionService;

    public ContentItemController(
            ContentItemRepository contentItemRepository,
            CreatorRepository creatorRepository,
            AgencyRepository agencyRepository,
            BrandRepository brandRepository,
            CampaignRepository campaignRepository,
            UserRepository userRepository,
            InstagramService instagramService,
            org.springframework.jdbc.core.JdbcTemplate jdbcTemplate,
            CacheEvictionService cacheEvictionService
    ) {
        this.contentItemRepository = contentItemRepository;
        this.creatorRepository = creatorRepository;
        this.agencyRepository = agencyRepository;
        this.brandRepository = brandRepository;
        this.campaignRepository = campaignRepository;
        this.userRepository = userRepository;
        this.instagramService = instagramService;
        this.jdbcTemplate = jdbcTemplate;
        this.cacheEvictionService = cacheEvictionService;
    }

    private Set<String> getDeletedAgencyNames() {
        Set<Long> deletedBrandIds = brandRepository.findAll().stream()
                .filter(b -> "DELETED".equalsIgnoreCase(b.getStatus()) && b.getId() != null)
                .map(BrandEntity::getId)
                .collect(Collectors.toSet());
        return agencyRepository.findAll().stream()
                .filter(a -> "DELETED".equalsIgnoreCase(a.getStatus())
                        || (a.getBrandId() != null && deletedBrandIds.contains(a.getBrandId())))
                .map(a -> a.getName() != null ? a.getName().trim().toLowerCase() : "")
                .filter(n -> !n.isEmpty())
                .collect(Collectors.toSet());
    }

    private String resolveCallerAgencyName(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
        if (caller == null || !"AGENCY_MANAGER".equalsIgnoreCase(caller.getRole())) {
            return null;
        }
        if (caller.getAgencyId() != null) {
            AgencyEntity a = agencyRepository.findById(caller.getAgencyId()).orElse(null);
            if (a != null && a.getName() != null && !a.getName().isBlank()) {
                return a.getName().trim();
            }
        }
        if (caller.getOrganizationName() != null && !caller.getOrganizationName().isBlank()) {
            return caller.getOrganizationName().trim();
        }
        AgencyEntity a = agencyRepository.findAll().stream()
                .filter(ag -> ag.getContactEmail() != null && ag.getContactEmail().trim().equalsIgnoreCase(caller.getEmail()))
                .findFirst().orElse(null);
        if (a != null && a.getName() != null && !a.getName().isBlank()) {
            return a.getName().trim();
        }
        return null;
    }

    private Set<String> resolveCallerBrandAgencyNames(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
        if (caller == null || !"BRAND_MANAGER".equalsIgnoreCase(caller.getRole())) {
            return null;
        }
        Long brandId = caller.getBrandId();
        String brandName = caller.getOrganizationName();
        if (brandId == null && (brandName == null || brandName.isBlank())) {
            return Set.of();
        }
        Set<Long> deletedBrandIds = brandRepository.findAll().stream()
                .filter(b -> "DELETED".equalsIgnoreCase(b.getStatus()) && b.getId() != null)
                .map(BrandEntity::getId)
                .collect(Collectors.toSet());

        return agencyRepository.findAll().stream()
                .filter(a -> !"DELETED".equalsIgnoreCase(a.getStatus()))
                .filter(a -> a.getBrandId() == null || !deletedBrandIds.contains(a.getBrandId()))
                .filter(a -> (brandId != null && brandId.equals(a.getBrandId()))
                        || (brandName != null && !brandName.isBlank() && a.getBrandName() != null && brandName.equalsIgnoreCase(a.getBrandName().trim())))
                .map(a -> a.getName() != null ? a.getName().trim().toLowerCase() : "")
                .filter(n -> !n.isEmpty())
                .collect(Collectors.toSet());
    }

    private String resolveAgencyForCaller(Authentication authentication, String fallback) {
        String callerAgency = resolveCallerAgencyName(authentication);
        if (callerAgency != null) {
            return callerAgency;
        }
        if (fallback != null && !fallback.isBlank()
                && !"All".equalsIgnoreCase(fallback)
                && !"Partner Agency".equalsIgnoreCase(fallback)) {
            return fallback.trim();
        }
        if (authentication != null && authentication.getName() != null) {
            UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
            if (caller != null && caller.getOrganizationName() != null && !caller.getOrganizationName().isBlank()) {
                return caller.getOrganizationName().trim();
            }
        }
        return (fallback != null && !fallback.isBlank()) ? fallback.trim() : "Partner Agency";
    }

    private void updateCreatorSlotCount(CreatorEntity creator) {
        List<ContentItemEntity> items = contentItemRepository.findByCreatorHandle(creator.getHandle());
        creator.setContentSlots(items.size() + (items.size() == 1 ? " post" : " posts"));
        creatorRepository.save(creator);
    }

    private void rebalancePackageDeliverablesIfApplicable(String handle) {
        if (handle == null || handle.isBlank()) return;
        String norm = InstagramService.normalizeHandle(handle);
        CreatorEntity creator = creatorRepository.findByHandleIgnoreCase(norm).orElse(null);
        if (creator == null || !"PACKAGE".equalsIgnoreCase(creator.getPricingModel())) return;

        List<ContentItemEntity> allItems = contentItemRepository.findAll().stream()
                .filter(ci -> ci.getCreatorHandle() != null && InstagramService.normalizeHandle(ci.getCreatorHandle()).equalsIgnoreCase(norm))
                .toList();
        if (allItems.isEmpty()) return;

        double share = (creator.getPrice() > 0 && !allItems.isEmpty()) ? (creator.getPrice() / allItems.size()) : 0.0;
        for (ContentItemEntity ci : allItems) {
            ci.setFinalPrice(share);
            contentItemRepository.save(ci);
        }
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER')")
    @Cacheable(value = CacheConfig.CACHE_CONTENT, key = "(#status != null ? #status : 'all') + '_' + (#agency != null ? #agency : 'all') + '_' + (#authentication != null ? #authentication.name : 'anon')")
    public ResponseEntity<List<ContentItemEntity>> getAllContent(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String agency,
            Authentication authentication
    ) {
        Set<String> hiddenAgencies = getDeletedAgencyNames();
        List<ContentItemEntity> all;
        if (agency != null && !agency.isBlank() && !agency.equalsIgnoreCase("all")) {
            all = contentItemRepository.findByAgencyName(agency);
        } else {
            all = contentItemRepository.findAll();
        }

        all = all.stream()
                .filter(c -> c.getAgencyName() == null || !hiddenAgencies.contains(c.getAgencyName().trim().toLowerCase()))
                .toList();

        String callerAgencyName = resolveCallerAgencyName(authentication);
        Set<String> brandAgencyNames = resolveCallerBrandAgencyNames(authentication);

        if (callerAgencyName != null) {
            final String finalAgency = callerAgencyName;
            all = all.stream()
                    .filter(c -> c.getAgencyName() != null && finalAgency.equalsIgnoreCase(c.getAgencyName().trim()))
                    .toList();
        } else if (brandAgencyNames != null) {
            UserEntity caller = authentication != null && authentication.getName() != null
                    ? userRepository.findByEmail(authentication.getName()).orElse(null) : null;
            Long callerBrandId = caller != null ? caller.getBrandId() : null;
            String callerBrandName = caller != null ? caller.getOrganizationName() : null;
            if ((callerBrandName == null || callerBrandName.isBlank()) && callerBrandId != null) {
                callerBrandName = brandRepository.findById(callerBrandId).map(BrandEntity::getName).orElse(null);
            }
            final String finalBrand = callerBrandName != null ? callerBrandName.trim() : null;

            Set<Long> brandCampaignIds = finalBrand != null ? campaignRepository.findAll().stream()
                    .filter(camp -> !"DELETED".equalsIgnoreCase(camp.getStatus()) && finalBrand.equalsIgnoreCase(camp.getBrandName()))
                    .map(CampaignEntity::getId)
                    .collect(Collectors.toSet()) : Set.of();

            all = all.stream()
                    .filter(c -> (c.getAgencyName() != null && brandAgencyNames.contains(c.getAgencyName().trim().toLowerCase()))
                            || (finalBrand != null && c.getAgencyName() != null && finalBrand.equalsIgnoreCase(c.getAgencyName().trim()))
                            || (c.getCampaignId() != null && brandCampaignIds.contains(c.getCampaignId())))
                    .toList();
        }

        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("all")) {
            all = all.stream()
                    .filter(c -> c.getStatus() != null && c.getStatus().equalsIgnoreCase(status))
                    .toList();
        }

        return ResponseEntity.ok(all);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER')")
    public ResponseEntity<?> addContent(
            @RequestBody AddContentRequest request,
            Authentication authentication
    ) {
        try {
            jdbcTemplate.execute("ALTER TABLE content_items ALTER COLUMN content_url TYPE TEXT");
            jdbcTemplate.execute("ALTER TABLE content_items ALTER COLUMN title TYPE TEXT");
            jdbcTemplate.execute("ALTER TABLE creators ALTER COLUMN avatar_url TYPE TEXT");
            jdbcTemplate.execute("ALTER TABLE creators ALTER COLUMN profile_url TYPE TEXT");
        } catch (Exception ignored) {
        }
        String normalizedHandle = InstagramService.normalizeHandle(request.getCreatorHandle());
        if (normalizedHandle.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Creator handle is required"));
        }

        String resolvedAgency = resolveAgencyForCaller(authentication, request.getAgencyName());

        // Automatically fetch creator details and insert into CreatorRepository if not yet rostered
        CreatorEntity creator = creatorRepository.findByHandleIgnoreCase(normalizedHandle)
                .orElseGet(() -> {
                    CreatorEntity fetched = instagramService.lookupCreatorProfile(normalizedHandle, resolvedAgency);
                    if (request.getFinalPrice() > 0) {
                        fetched.setPrice(request.getFinalPrice());
                    }
                    return creatorRepository.save(fetched);
                });

        boolean isPackage = "PACKAGE".equalsIgnoreCase(creator.getPricingModel());

        if (!isPackage) {
            double priceToValidate = request.getFinalPrice() > 0 ? request.getFinalPrice() : creator.getPrice();
            String handleLabel = creator.getHandle().startsWith("@") ? creator.getHandle() : "@" + creator.getHandle();
            if (creator.getMinPrice() != null && creator.getMinPrice() > 0 && priceToValidate < creator.getMinPrice()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Deliverable price (₹" + (long) priceToValidate + ") is below minimum allowed rate of ₹" + (long) (double) creator.getMinPrice() + " for " + handleLabel
                ));
            }
            if (creator.getMaxPrice() != null && creator.getMaxPrice() > 0 && priceToValidate > creator.getMaxPrice()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Deliverable price (₹" + (long) priceToValidate + ") exceeds maximum allowed rate of ₹" + (long) (double) creator.getMaxPrice() + " for " + handleLabel
                ));
            }
            if (request.getFinalPrice() > 0) {
                creator.setPrice(request.getFinalPrice());
                creatorRepository.save(creator);
            }
        }

        String agency = resolveAgencyForCaller(authentication,
                request.getAgencyName() != null && !request.getAgencyName().isBlank()
                        ? request.getAgencyName()
                        : creator.getAgencyName());

        ContentItemEntity item = new ContentItemEntity();
        item.setCreatorHandle(normalizedHandle);
        item.setAgencyName(agency);
        item.setTitle(request.getTitle() != null && !request.getTitle().isBlank() ? request.getTitle().trim() : "Campaign Deliverable");
        item.setContentUrl(request.getContentUrl() != null ? request.getContentUrl().trim() : "");
        if (request.getThumbnailUrl() != null && !request.getThumbnailUrl().isBlank()) {
            item.setThumbnailUrl(request.getThumbnailUrl().trim());
        }
        item.setFormat(request.getFormat() != null && !request.getFormat().isBlank() ? request.getFormat() : "Instagram Reel");
        item.setPublishedDate("Nov 2026");
        item.setViews(request.getViews());
        item.setLikes(request.getLikes());
        item.setComments(request.getComments());

        if (isPackage) {
            List<ContentItemEntity> existing = contentItemRepository.findAll().stream()
                    .filter(ci -> ci.getCreatorHandle() != null && InstagramService.normalizeHandle(ci.getCreatorHandle()).equalsIgnoreCase(normalizedHandle))
                    .toList();
            int totalCount = existing.size() + 1;
            double share = creator.getPrice() > 0 ? (creator.getPrice() / totalCount) : 0.0;
            item.setFinalPrice(share);
        } else {
            double finalDeliverablePrice = 0.0;
            if (request.getFinalPrice() > 0) {
                finalDeliverablePrice = request.getFinalPrice();
            } else if (creator.getPrice() > 0) {
                finalDeliverablePrice = creator.getPrice();
            } else if (creator.getMinPrice() != null && creator.getMinPrice() > 0) {
                finalDeliverablePrice = creator.getMinPrice();
                creator.setPrice(finalDeliverablePrice);
                creatorRepository.save(creator);
            }
            item.setFinalPrice(finalDeliverablePrice);
        }

        item.setStatus(request.getContentUrl() != null && !request.getContentUrl().isBlank() ? "WITH_INSIGHTS" : "MISSING_URL");
        if (request.getCampaignId() != null) {
            item.setCampaignId(request.getCampaignId());
            item.setCampaignName(request.getCampaignName());
        } else if (creator.getCampaignId() != null) {
            item.setCampaignId(creator.getCampaignId());
            item.setCampaignName(creator.getCampaignName());
        }

        ContentItemEntity saved = contentItemRepository.save(item);

        // If URL is an Instagram post/reel, trigger live sync
        if (saved.getContentUrl() != null && saved.getContentUrl().contains("instagram.com")) {
            saved = instagramService.syncContentItem(saved);
        }

        if (isPackage) {
            rebalancePackageDeliverablesIfApplicable(creator.getHandle());
        }

        // Roll up content metrics & slot count onto the CreatorEntity
        instagramService.rollUpCreatorMetrics(creator.getHandle());
        cacheEvictionService.evictContent();
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER')")
    public ResponseEntity<?> updateContent(
            @PathVariable Long id,
            @RequestBody AddContentRequest request
    ) {
        ContentItemEntity item = contentItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Deliverable not found"));

        CreatorEntity creator = creatorRepository.findByHandleIgnoreCase(InstagramService.normalizeHandle(item.getCreatorHandle())).orElse(null);
        boolean isPackage = creator != null && "PACKAGE".equalsIgnoreCase(creator.getPricingModel());

        if (!isPackage && creator != null && request.getFinalPrice() > 0) {
            if (creator.getMinPrice() != null && creator.getMinPrice() > 0 && request.getFinalPrice() < creator.getMinPrice()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Deliverable price (₹" + (long) request.getFinalPrice() + ") is below minimum allowed rate of ₹" + (long) (double) creator.getMinPrice() + " for @" + creator.getHandle()
                ));
            }
            if (creator.getMaxPrice() != null && creator.getMaxPrice() > 0 && request.getFinalPrice() > creator.getMaxPrice()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Deliverable price (₹" + (long) request.getFinalPrice() + ") exceeds maximum allowed rate of ₹" + (long) (double) creator.getMaxPrice() + " for @" + creator.getHandle()
                ));
            }
        }

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            item.setTitle(request.getTitle().trim());
        }
        if (request.getCreatorHandle() != null && !request.getCreatorHandle().isBlank()) {
            item.setCreatorHandle(InstagramService.normalizeHandle(request.getCreatorHandle()));
        }
        if (request.getFormat() != null && !request.getFormat().isBlank()) {
            item.setFormat(request.getFormat().trim());
        }
        if (request.getContentUrl() != null) {
            String url = request.getContentUrl().trim();
            item.setContentUrl(url);
            item.setStatus(!url.isBlank() ? "WITH_INSIGHTS" : "MISSING_URL");
        }
        if (!isPackage && request.getFinalPrice() >= 0) {
            item.setFinalPrice(request.getFinalPrice());
        }
        if (request.getCampaignId() != null) {
            item.setCampaignId(request.getCampaignId());
            item.setCampaignName(request.getCampaignName());
        }

        ContentItemEntity saved = contentItemRepository.save(item);
        if (saved.getContentUrl() != null && saved.getContentUrl().contains("instagram.com")) {
            saved = instagramService.syncContentItem(saved);
        }

        if (isPackage) {
            rebalancePackageDeliverablesIfApplicable(saved.getCreatorHandle());
        } else if (creator != null) {
            if (request.getFinalPrice() > 0) {
                creator.setPrice(request.getFinalPrice());
                creatorRepository.save(creator);
            }
            instagramService.rollUpCreatorMetrics(creator.getHandle());
        }

        cacheEvictionService.evictContent();
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER')")
    public ResponseEntity<Map<String, String>> deleteContent(@PathVariable Long id, Authentication authentication) {
        ContentItemEntity item = contentItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Deliverable not found"));

        String callerAgencyName = resolveCallerAgencyName(authentication);
        if (callerAgencyName != null && item.getAgencyName() != null
                && !callerAgencyName.equalsIgnoreCase(item.getAgencyName().trim())) {
            throw new RuntimeException("Access denied: You can only delete deliverables submitted by your agency.");
        }

        String handle = item.getCreatorHandle();
        contentItemRepository.delete(item);

        if (handle != null) {
            rebalancePackageDeliverablesIfApplicable(handle);
            instagramService.rollUpCreatorMetrics(handle);
        }
        cacheEvictionService.evictContent();
        return ResponseEntity.ok(Map.of("message", "Deliverable deleted successfully"));
    }

    @PostMapping("/{id}/sync-instagram")
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER')")
    public ResponseEntity<?> syncInstagramMetrics(@PathVariable Long id) {
        return contentItemRepository.findById(id)
                .map(item -> {
                    ContentItemEntity updated = instagramService.syncContentItem(item);
                    cacheEvictionService.evictContent();
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
