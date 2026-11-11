package com.converge.converge_backend.controller;

import com.converge.converge_backend.config.CacheConfig;
import com.converge.converge_backend.dto.CreatorDetailDto;
import com.converge.converge_backend.entity.AgencyEntity;
import com.converge.converge_backend.entity.BrandEntity;
import com.converge.converge_backend.entity.ContentItemEntity;
import com.converge.converge_backend.entity.CreatorEntity;
import com.converge.converge_backend.entity.UserEntity;
import com.converge.converge_backend.repository.AgencyRepository;
import com.converge.converge_backend.repository.BrandRepository;
import com.converge.converge_backend.repository.ContentItemRepository;
import com.converge.converge_backend.repository.CreatorRepository;
import com.converge.converge_backend.repository.UserRepository;
import com.converge.converge_backend.service.CacheEvictionService;
import com.converge.converge_backend.service.InstagramService;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/creators")
public class CreatorController {

    private final CreatorRepository creatorRepository;
    private final ContentItemRepository contentItemRepository;
    private final AgencyRepository agencyRepository;
    private final BrandRepository brandRepository;
    private final UserRepository userRepository;
    private final InstagramService instagramService;
    private final JdbcTemplate jdbcTemplate;
    private final CacheEvictionService cacheEvictionService;
    private final AtomicBoolean columnsWidened = new AtomicBoolean(false);

    public CreatorController(
            CreatorRepository creatorRepository,
            ContentItemRepository contentItemRepository,
            AgencyRepository agencyRepository,
            BrandRepository brandRepository,
            UserRepository userRepository,
            InstagramService instagramService,
            JdbcTemplate jdbcTemplate,
            CacheEvictionService cacheEvictionService
    ) {
        this.creatorRepository = creatorRepository;
        this.contentItemRepository = contentItemRepository;
        this.agencyRepository = agencyRepository;
        this.brandRepository = brandRepository;
        this.userRepository = userRepository;
        this.instagramService = instagramService;
        this.jdbcTemplate = jdbcTemplate;
        this.cacheEvictionService = cacheEvictionService;
    }

    private void ensureTextColumns() {
        if (columnsWidened.compareAndSet(false, true)) {
            String[] ddl = {
                    "ALTER TABLE creators ALTER COLUMN avatar_url TYPE TEXT",
                    "ALTER TABLE creators ALTER COLUMN profile_url TYPE TEXT",
                    "ALTER TABLE creators ALTER COLUMN name TYPE TEXT",
                    "ALTER TABLE creators ALTER COLUMN agency_name TYPE TEXT",
                    "ALTER TABLE creators ALTER COLUMN category TYPE TEXT",
                    "ALTER TABLE creators ALTER COLUMN platform TYPE TEXT",
                    "ALTER TABLE creators ALTER COLUMN content_slots TYPE TEXT",
                    "ALTER TABLE content_items ALTER COLUMN content_url TYPE TEXT",
                    "ALTER TABLE content_items ALTER COLUMN title TYPE TEXT",
                    "ALTER TABLE content_items ALTER COLUMN creator_handle TYPE TEXT",
                    "ALTER TABLE content_items ALTER COLUMN agency_name TYPE TEXT",
                    "ALTER TABLE content_items ALTER COLUMN format TYPE TEXT",
                    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT",
                    "ALTER TABLE content_items ALTER COLUMN thumbnail_url TYPE TEXT",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS followers_count BIGINT DEFAULT 0",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS follows_count BIGINT DEFAULT 0",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS media_count BIGINT DEFAULT 0",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Micro'",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS creator_type TEXT DEFAULT 'Influencer'",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS audience_fit INT DEFAULT 5",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS content_quality INT DEFAULT 5",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS authenticity_risk TEXT DEFAULT 'Low'",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS brand_id BIGINT",
                    "ALTER TABLE creators ADD COLUMN IF NOT EXISTS brand_name TEXT",
                    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS campaign_id BIGINT",
                    "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS campaign_name TEXT"
            };
            for (String sql : ddl) {
                try {
                    jdbcTemplate.execute(sql);
                } catch (Exception ignored) {
                }
            }
        }
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

    private String resolveAgencyName(Authentication authentication, String providedAgency) {
        String callerAgency = resolveCallerAgencyName(authentication);
        if (callerAgency != null) {
            return callerAgency;
        }
        if (providedAgency != null && !providedAgency.isBlank()
                && !"All".equalsIgnoreCase(providedAgency)
                && !"Partner Agency".equalsIgnoreCase(providedAgency)) {
            return providedAgency.trim();
        }
        if (authentication != null && authentication.getName() != null) {
            UserEntity caller = userRepository.findByEmail(authentication.getName()).orElse(null);
            if (caller != null && caller.getOrganizationName() != null && !caller.getOrganizationName().isBlank()) {
                return caller.getOrganizationName().trim();
            }
        }
        return (providedAgency != null && !providedAgency.isBlank()) ? providedAgency.trim() : "Partner Agency";
    }

    private CreatorEntity scopeCreatorForAgency(CreatorEntity creator, String agencyName) {
        return scopeCreatorForAgency(creator, agencyName, null);
    }

    private CreatorEntity scopeCreatorForAgency(CreatorEntity creator, String agencyName, Map<String, List<ContentItemEntity>> itemsByHandle) {
        String handleKey = creator.getHandle() != null ? creator.getHandle().trim().toLowerCase() : "";
        List<ContentItemEntity> allItems = itemsByHandle != null
                ? itemsByHandle.getOrDefault(handleKey, List.of())
                : contentItemRepository.findByCreatorHandle(creator.getHandle());

        List<ContentItemEntity> agencyItems = allItems.stream()
                .filter(ci -> ci.getAgencyName() != null && ci.getAgencyName().trim().equalsIgnoreCase(agencyName))
                .toList();

        CreatorEntity scoped = new CreatorEntity();
        scoped.setId(creator.getId());
        scoped.setName(creator.getName());
        scoped.setHandle(creator.getHandle());
        scoped.setAgencyName(agencyName);
        scoped.setCategory(creator.getCategory());
        scoped.setPlatform(creator.getPlatform() != null ? creator.getPlatform() : "Instagram");
        scoped.setProfileUrl(creator.getProfileUrl());
        scoped.setAvatarUrl(creator.getAvatarUrl());
        scoped.setAvatarInitials(creator.getAvatarInitials());

        int slots = agencyItems.size();
        scoped.setContentSlots(slots + (slots == 1 ? " post" : " posts"));
        scoped.setViews(agencyItems.stream().mapToLong(ContentItemEntity::getViews).sum());
        scoped.setLikes(agencyItems.stream().mapToLong(ContentItemEntity::getLikes).sum());
        scoped.setComments(agencyItems.stream().mapToLong(ContentItemEntity::getComments).sum());

        double agencyPrice = agencyItems.stream()
                .mapToDouble(ContentItemEntity::getFinalPrice)
                .filter(p -> p > 0)
                .findFirst()
                .orElse(creator.getPrice());
        scoped.setPrice(agencyPrice);
        scoped.setMinPrice(creator.getMinPrice());
        scoped.setMaxPrice(creator.getMaxPrice());
        scoped.setPricingModel(creator.getPricingModel());
        scoped.setFollowersCount(creator.getFollowersCount());
        scoped.setFollowsCount(creator.getFollowsCount());
        scoped.setMediaCount(creator.getMediaCount());
        scoped.setTier(creator.getTier());
        scoped.setCreatorType(creator.getCreatorType());
        scoped.setAudienceFit(creator.getAudienceFit());
        scoped.setContentQuality(creator.getContentQuality());
        scoped.setAuthenticityRisk(creator.getAuthenticityRisk());
        return scoped;
    }

    private CreatorEntity enrichCreator(CreatorEntity creator) {
        return enrichCreatorFast(creator, null);
    }

    private CreatorEntity enrichCreatorFast(CreatorEntity creator, Map<String, List<ContentItemEntity>> itemsByHandle) {
        boolean changed = false;
        String username = creator.getHandle() != null ? creator.getHandle().replaceFirst("^@+", "").trim() : "";
        if ((creator.getAvatarUrl() == null || creator.getAvatarUrl().isBlank()) && !username.isEmpty()) {
            creator.setAvatarUrl("https://unavatar.io/instagram/" + username);
            changed = true;
        }
        if ("TikTok".equalsIgnoreCase(creator.getPlatform())) {
            creator.setPlatform("Instagram");
            changed = true;
        }
        if (creator.getTier() == null || creator.getTier().isBlank()) {
            creator.computeAutoTier();
            changed = true;
        }

        // Asynchronously enrich live account stats in background if followers is 0,
        // so read HTTP endpoints are never blocked by external third-party API calls!
        if ((creator.getFollowersCount() == 0 || creator.getMediaCount() == 0) && !username.isEmpty()) {
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    instagramService.fetchLiveAccountStats(creator);
                    if (creator.getFollowersCount() > 0 && creator.getId() != null) {
                        creatorRepository.save(creator);
                    }
                } catch (Exception ignored) {}
            });
        }

        String handleKey = creator.getHandle() != null ? creator.getHandle().trim().toLowerCase() : "";
        List<ContentItemEntity> items = itemsByHandle != null
                ? itemsByHandle.getOrDefault(handleKey, List.of())
                : contentItemRepository.findByCreatorHandle(creator.getHandle());

        String slotLabel = items.size() + (items.size() == 1 ? " post" : " posts");
        if (!slotLabel.equals(creator.getContentSlots())) {
            creator.setContentSlots(slotLabel);
            changed = true;
        }

        long totalViews = items.stream().mapToLong(ContentItemEntity::getViews).sum();
        long totalLikes = items.stream().mapToLong(ContentItemEntity::getLikes).sum();
        long totalComments = items.stream().mapToLong(ContentItemEntity::getComments).sum();
        if (creator.getViews() != totalViews) {
            creator.setViews(totalViews);
            changed = true;
        }
        if (creator.getLikes() != totalLikes) {
            creator.setLikes(totalLikes);
            changed = true;
        }
        if (creator.getComments() != totalComments) {
            creator.setComments(totalComments);
            changed = true;
        }

        if (changed && creator.getId() != null) {
            return creatorRepository.save(creator);
        }
        return creator;
    }

    private void syncSubmittedContentUrls(CreatorEntity creator, List<String> contentUrls, String agencyName, double price) {
        if (contentUrls == null || contentUrls.isEmpty()) {
            return;
        }
        List<ContentItemEntity> existingItems = contentItemRepository.findByCreatorHandle(creator.getHandle());
        int idx = (int) existingItems.stream()
                .filter(i -> agencyName != null && agencyName.equalsIgnoreCase(i.getAgencyName()))
                .count() + 1;

        // Split any combined/pasted URLs (space, newline, comma separated)
        java.util.List<String> individualUrls = new java.util.ArrayList<>();
        for (String raw : contentUrls) {
            if (raw == null || raw.isBlank()) continue;
            for (String part : raw.split("[\\r\\n, ]+")) {
                String trimmed = part.trim();
                if (!trimmed.isBlank() && (trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
                    individualUrls.add(trimmed);
                }
            }
        }

        boolean isPackage = "PACKAGE".equalsIgnoreCase(creator.getPricingModel());
        double baseRate = price > 0 ? price : creator.getPrice();
        double perItemPrice = isPackage && !individualUrls.isEmpty() ? (baseRate / individualUrls.size()) : baseRate;

        for (String cleanUrl : individualUrls) {
            boolean alreadyExists = existingItems.stream()
                    .anyMatch(item -> cleanUrl.equalsIgnoreCase(item.getContentUrl())
                            && (agencyName == null || agencyName.equalsIgnoreCase(item.getAgencyName())));
            if (alreadyExists) continue;

            ContentItemEntity item = new ContentItemEntity();
            item.setCreatorHandle(creator.getHandle());
            item.setAgencyName(agencyName != null ? agencyName : creator.getAgencyName());
            item.setTitle(creator.getName() + " — Deliverable #" + idx++);
            item.setContentUrl(cleanUrl);
            item.setFormat(cleanUrl.contains("/reel/") ? "Instagram Reel" : (cleanUrl.contains("/p/") ? "Instagram Post" : "Instagram Reel"));
            item.setPublishedDate("Nov 2026");
            item.setFinalPrice(perItemPrice);
            item.setStatus("WITH_INSIGHTS");
            ContentItemEntity saved = contentItemRepository.save(item);
            instagramService.syncContentItem(saved);
        }
        if (isPackage) {
            rebalancePackageDeliverables(creator.getHandle());
        }
        instagramService.rollUpCreatorMetrics(creator.getHandle());
    }

    private void rebalancePackageDeliverables(String handle) {
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
    @Cacheable(value = CacheConfig.CACHE_CREATORS, key = "(#agency != null ? #agency : 'all') + '_' + (#authentication != null ? #authentication.name : 'anon')")
    public ResponseEntity<List<CreatorEntity>> getCreators(
            @RequestParam(required = false) String agency,
            Authentication authentication
    ) {
        Set<String> hiddenAgencies = getDeletedAgencyNames();
        String callerAgencyName = resolveCallerAgencyName(authentication);
        Set<String> brandAgencyNames = resolveCallerBrandAgencyNames(authentication);

        // Pre-fetch all content items in ONE bulk query to eliminate the N+1 round-trip bottleneck
        List<ContentItemEntity> allContentItems = contentItemRepository.findAll();
        Map<String, List<ContentItemEntity>> itemsByHandle = allContentItems.stream()
                .filter(ci -> ci.getCreatorHandle() != null)
                .collect(Collectors.groupingBy(ci -> ci.getCreatorHandle().trim().toLowerCase()));

        if (callerAgencyName != null) {
            final String finalAgency = callerAgencyName;
            Set<String> creatorHandlesWithAgencyContent = allContentItems.stream()
                    .filter(ci -> ci.getAgencyName() != null && ci.getAgencyName().trim().equalsIgnoreCase(finalAgency))
                    .map(ContentItemEntity::getCreatorHandle)
                    .filter(h -> h != null && !h.isBlank())
                    .map(h -> h.trim().toLowerCase())
                    .collect(Collectors.toSet());

            List<CreatorEntity> agencyCreators = creatorRepository.findAll().stream()
                    .filter(c -> c.getAgencyName() == null || !hiddenAgencies.contains(c.getAgencyName().trim().toLowerCase()))
                    .filter(c -> (c.getAgencyName() != null && c.getAgencyName().trim().equalsIgnoreCase(finalAgency))
                            || (c.getHandle() != null && creatorHandlesWithAgencyContent.contains(c.getHandle().trim().toLowerCase())))
                    .map(c -> scopeCreatorForAgency(c, finalAgency, itemsByHandle))
                    .toList();
            return ResponseEntity.ok(agencyCreators);
        }

        if (brandAgencyNames != null) {
            UserEntity caller = authentication != null && authentication.getName() != null
                    ? userRepository.findByEmail(authentication.getName()).orElse(null) : null;
            Long callerBrandId = caller != null ? caller.getBrandId() : null;
            String callerBrandName = caller != null ? caller.getOrganizationName() : null;

            Set<String> creatorHandlesWithBrandContent = allContentItems.stream()
                    .filter(ci -> ci.getAgencyName() != null && (
                            brandAgencyNames.contains(ci.getAgencyName().trim().toLowerCase())
                            || (callerBrandName != null && callerBrandName.trim().equalsIgnoreCase(ci.getAgencyName().trim()))
                    ))
                    .map(ContentItemEntity::getCreatorHandle)
                    .filter(h -> h != null && !h.isBlank())
                    .map(h -> h.trim().toLowerCase())
                    .collect(Collectors.toSet());

            List<CreatorEntity> brandCreators = creatorRepository.findAll().stream()
                    .filter(c -> c.getAgencyName() == null || !hiddenAgencies.contains(c.getAgencyName().trim().toLowerCase()))
                    .filter(c -> {
                        // 1. Creator belongs to one of the brand's connected agencies
                        if (c.getAgencyName() != null && brandAgencyNames.contains(c.getAgencyName().trim().toLowerCase())) {
                            return true;
                        }
                        // 2. Creator was directly onboarded by this brand (brandId match)
                        if (callerBrandId != null && callerBrandId.equals(c.getBrandId())) {
                            return true;
                        }
                        // 3. Creator was directly onboarded by this brand (brandName match or agencyName equals brandName)
                        if (callerBrandName != null && !callerBrandName.isBlank()) {
                            if (c.getBrandName() != null && callerBrandName.trim().equalsIgnoreCase(c.getBrandName().trim())) {
                                return true;
                            }
                            if (c.getAgencyName() != null && callerBrandName.trim().equalsIgnoreCase(c.getAgencyName().trim())) {
                                return true;
                            }
                        }
                        // 4. Creator has deliverables associated with this brand
                        if (c.getHandle() != null && creatorHandlesWithBrandContent.contains(c.getHandle().trim().toLowerCase())) {
                            return true;
                        }
                        return false;
                    })
                    .filter(c -> {
                        if (agency != null && !agency.isBlank() && !agency.equalsIgnoreCase("All")) {
                            return c.getAgencyName() != null && agency.equalsIgnoreCase(c.getAgencyName().trim());
                        }
                        return true;
                    })
                    .map(c -> enrichCreatorFast(c, itemsByHandle))
                    .toList();
            return ResponseEntity.ok(brandCreators);
        }

        List<CreatorEntity> list;
        if (agency != null && !agency.isBlank() && !agency.equalsIgnoreCase("All")) {
            list = creatorRepository.findByAgencyNameIgnoreCase(agency);
        } else {
            list = creatorRepository.findAll();
        }
        List<CreatorEntity> enriched = list.stream()
                .filter(c -> c.getAgencyName() == null || !hiddenAgencies.contains(c.getAgencyName().trim().toLowerCase()))
                .map(c -> enrichCreatorFast(c, itemsByHandle))
                .toList();
        return ResponseEntity.ok(enriched);
    }

    @GetMapping("/lookup")
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER')")
    public ResponseEntity<?> lookupCreator(
            @RequestParam String handle,
            @RequestParam(required = false) String agency,
            @RequestParam(defaultValue = "false") boolean save,
            Authentication authentication
    ) {
        try {
            String resolvedAgency = resolveAgencyName(authentication, agency);
            CreatorEntity resolved = instagramService.lookupCreatorProfile(handle, resolvedAgency);
            if (save && resolved.getId() == null) {
                resolved = creatorRepository.save(resolved);
            }
            String callerAgencyName = resolveCallerAgencyName(authentication);
            if (callerAgencyName != null) {
                return ResponseEntity.ok(scopeCreatorForAgency(resolved, callerAgencyName, null));
            }
            return ResponseEntity.ok(enrichCreatorFast(resolved, null));
        } catch (RuntimeException re) {
            return ResponseEntity.badRequest().body(Map.of("message", re.getMessage()));
        }
    }

    @GetMapping("/{handle}")
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER')")
    @Cacheable(value = CacheConfig.CACHE_CREATOR_DETAIL, key = "#handle.toLowerCase() + '_' + (#authentication != null ? #authentication.name : 'anon')")
    public ResponseEntity<CreatorDetailDto> getCreatorDetail(
            @PathVariable String handle,
            Authentication authentication
    ) {
        String formattedHandle = InstagramService.normalizeHandle(handle);
        CreatorEntity creator = creatorRepository.findByHandleIgnoreCase(formattedHandle)
                .orElseThrow(() -> new RuntimeException("Creator not found: " + formattedHandle));

        List<ContentItemEntity> allItems = contentItemRepository.findByCreatorHandle(formattedHandle);
        Map<String, List<ContentItemEntity>> singleMap = Map.of(formattedHandle.toLowerCase(), allItems);
        creator = enrichCreatorFast(creator, singleMap);

        String callerAgencyName = resolveCallerAgencyName(authentication);
        if (callerAgencyName != null) {
            final String finalAgency = callerAgencyName;
            List<ContentItemEntity> agencyItems = allItems.stream()
                    .filter(ci -> ci.getAgencyName() != null && ci.getAgencyName().trim().equalsIgnoreCase(finalAgency))
                    .toList();

            boolean creatorBelongsToAgency = (creator.getAgencyName() != null && creator.getAgencyName().trim().equalsIgnoreCase(finalAgency))
                    || !agencyItems.isEmpty();

            if (!creatorBelongsToAgency) {
                throw new RuntimeException("Access denied: Creator @" + formattedHandle + " is not rostered under your agency.");
            }

            CreatorEntity scopedCreator = scopeCreatorForAgency(creator, finalAgency, singleMap);
            return ResponseEntity.ok(new CreatorDetailDto(scopedCreator, agencyItems));
        }

        Set<String> brandAgencyNames = resolveCallerBrandAgencyNames(authentication);
        if (brandAgencyNames != null) {
            UserEntity caller = authentication != null && authentication.getName() != null
                    ? userRepository.findByEmail(authentication.getName()).orElse(null) : null;
            Long callerBrandId = caller != null ? caller.getBrandId() : null;
            String callerBrandName = caller != null ? caller.getOrganizationName() : null;

            boolean creatorBelongsToBrand =
                    (callerBrandId != null && callerBrandId.equals(creator.getBrandId()))
                    || (callerBrandName != null && creator.getBrandName() != null && callerBrandName.trim().equalsIgnoreCase(creator.getBrandName().trim()))
                    || (callerBrandName != null && creator.getAgencyName() != null && callerBrandName.trim().equalsIgnoreCase(creator.getAgencyName().trim()))
                    || (creator.getAgencyName() != null && brandAgencyNames.contains(creator.getAgencyName().trim().toLowerCase()))
                    || allItems.stream().anyMatch(ci -> ci.getAgencyName() != null && (
                            brandAgencyNames.contains(ci.getAgencyName().trim().toLowerCase())
                            || (callerBrandName != null && callerBrandName.trim().equalsIgnoreCase(ci.getAgencyName().trim()))
                    ));

            if (!creatorBelongsToBrand) {
                throw new RuntimeException("Access denied: Creator @" + formattedHandle + " is not rostered under any partner agency connected to your brand.");
            }
        }

        return ResponseEntity.ok(new CreatorDetailDto(creator, allItems));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('BRAND_MANAGER', 'AGENCY_MANAGER')")
    public ResponseEntity<CreatorEntity> addCreator(
            @RequestBody CreatorEntity creator,
            Authentication authentication
    ) {
        ensureTextColumns();
        String normalized = InstagramService.normalizeHandle(creator.getHandle());
        if (normalized.isBlank()) {
            throw new RuntimeException("Creator handle is required.");
        }
        String callerAgencyName = resolveCallerAgencyName(authentication);
        String resolvedAgency = callerAgencyName != null ? callerAgencyName : resolveAgencyName(authentication, creator.getAgencyName());
        creator.setHandle(normalized);
        creator.setPlatform("Instagram");

        List<String> submittedUrls = creator.getContentUrls();
        double submittedPrice = creator.getPrice();

        UserEntity callerUser = authentication != null && authentication.getName() != null
                ? userRepository.findByEmail(authentication.getName()).orElse(null) : null;
        Long brandIdToSet = (callerUser != null && "BRAND_MANAGER".equalsIgnoreCase(callerUser.getRole()))
                ? callerUser.getBrandId() : creator.getBrandId();
        String brandNameToSet = (callerUser != null && "BRAND_MANAGER".equalsIgnoreCase(callerUser.getRole()))
                ? callerUser.getOrganizationName() : creator.getBrandName();

        if (callerUser != null && "AGENCY_MANAGER".equalsIgnoreCase(callerUser.getRole())) {
            if (callerUser.getAgencyId() != null) {
                AgencyEntity ag = agencyRepository.findById(callerUser.getAgencyId()).orElse(null);
                if (ag != null) {
                    if (brandIdToSet == null) brandIdToSet = ag.getBrandId();
                    if (brandNameToSet == null) brandNameToSet = ag.getBrandName();
                }
            }
            if (brandIdToSet == null && callerUser.getBrandId() != null) {
                brandIdToSet = callerUser.getBrandId();
                brandNameToSet = brandRepository.findById(brandIdToSet).map(BrandEntity::getName).orElse(null);
            }
        }

        CreatorEntity existing = creatorRepository.findByHandleIgnoreCase(normalized).orElse(null);
        if (existing != null) {
            if (creator.getName() != null && !creator.getName().isBlank()) existing.setName(creator.getName().trim());
            if (existing.getAgencyName() == null || existing.getAgencyName().isBlank() || "Partner Agency".equalsIgnoreCase(existing.getAgencyName())) {
                existing.setAgencyName(resolvedAgency);
            }
            if (brandIdToSet != null) existing.setBrandId(brandIdToSet);
            if (brandNameToSet != null && !brandNameToSet.isBlank()) existing.setBrandName(brandNameToSet);
            if (creator.getCategory() != null && !creator.getCategory().isBlank()) existing.setCategory(creator.getCategory().trim());
            existing.setPlatform("Instagram");
            if (creator.getProfileUrl() != null && !creator.getProfileUrl().isBlank()) existing.setProfileUrl(creator.getProfileUrl().trim());
            if (creator.getAvatarUrl() != null && !creator.getAvatarUrl().isBlank()) existing.setAvatarUrl(creator.getAvatarUrl().trim());
            if (submittedPrice > 0 && (existing.getPrice() == 0 || callerAgencyName == null)) {
                existing.setPrice(submittedPrice);
            }
            if (creator.getCampaignId() != null) {
                existing.setCampaignId(creator.getCampaignId());
                existing.setCampaignName(creator.getCampaignName());
            }
            if (creator.getAudienceFit() > 0) existing.setAudienceFit(creator.getAudienceFit());
            if (creator.getContentQuality() > 0) existing.setContentQuality(creator.getContentQuality());
            if (creator.getAuthenticityRisk() != null && !creator.getAuthenticityRisk().isBlank()) existing.setAuthenticityRisk(creator.getAuthenticityRisk());
            if (creator.getPricingModel() != null && !creator.getPricingModel().isBlank()) existing.setPricingModel(creator.getPricingModel().trim());
            if (creator.getMinPrice() != null) existing.setMinPrice(creator.getMinPrice());
            if (creator.getMaxPrice() != null) existing.setMaxPrice(creator.getMaxPrice());
            CreatorEntity savedExisting = creatorRepository.save(existing);
            syncSubmittedContentUrls(savedExisting, submittedUrls, resolvedAgency, submittedPrice);
            cacheEvictionService.evictCreators();
            if (callerAgencyName != null) {
                return ResponseEntity.ok(scopeCreatorForAgency(savedExisting, callerAgencyName));
            }
            return ResponseEntity.ok(enrichCreator(savedExisting));
        }

        CreatorEntity fetched = instagramService.lookupCreatorProfile(normalized, resolvedAgency);
        creator.setAgencyName(resolvedAgency);
        if (brandIdToSet != null) creator.setBrandId(brandIdToSet);
        if (brandNameToSet != null && !brandNameToSet.isBlank()) creator.setBrandName(brandNameToSet);
        if (creator.getName() == null || creator.getName().isBlank()) {
            creator.setName(fetched.getName());
        }
        if (creator.getAvatarInitials() == null || creator.getAvatarInitials().isBlank()) {
            creator.setAvatarInitials(fetched.getAvatarInitials());
        }
        if (creator.getAvatarUrl() == null || creator.getAvatarUrl().isBlank()) {
            creator.setAvatarUrl(fetched.getAvatarUrl());
        }
        if (creator.getProfileUrl() == null || creator.getProfileUrl().isBlank()) {
            creator.setProfileUrl(fetched.getProfileUrl());
        }
        if (creator.getAudienceFit() <= 0) creator.setAudienceFit(5);
        if (creator.getContentQuality() <= 0) creator.setContentQuality(5);
        if (creator.getAuthenticityRisk() == null || creator.getAuthenticityRisk().isBlank()) creator.setAuthenticityRisk("Low");
        if (creator.getPricingModel() == null || creator.getPricingModel().isBlank()) creator.setPricingModel("PER_DELIVERABLE");
        creator.setMinPrice(creator.getMinPrice());
        creator.setMaxPrice(creator.getMaxPrice());

        CreatorEntity saved = creatorRepository.save(creator);
        syncSubmittedContentUrls(saved, submittedUrls, resolvedAgency, submittedPrice);
        cacheEvictionService.evictCreators();
        if (callerAgencyName != null) {
            return ResponseEntity.ok(scopeCreatorForAgency(saved, callerAgencyName));
        }
        return ResponseEntity.ok(enrichCreator(saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER')")
    public ResponseEntity<CreatorEntity> updateCreator(
            @PathVariable Long id,
            @RequestBody CreatorEntity payload,
            Authentication authentication
    ) {
        CreatorEntity creator = creatorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Creator not found"));

        String oldHandle = creator.getHandle();
        // Note: Username/Handle is locked and immutable to prevent duplicate/hijacking flaws.
        if (payload.getName() != null && !payload.getName().isBlank()) {
            creator.setName(payload.getName().trim());
            String[] parts = creator.getName().split("\\s+");
            String initials = parts.length >= 2
                    ? ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
                    : creator.getName().substring(0, Math.min(2, creator.getName().length())).toUpperCase();
            creator.setAvatarInitials(initials);
        }
        if (payload.getCategory() != null && !payload.getCategory().isBlank()) {
            creator.setCategory(payload.getCategory().trim());
        }
        if (payload.getProfileUrl() != null) {
            creator.setProfileUrl(payload.getProfileUrl().trim());
        }
        if (payload.getAvatarUrl() != null && !payload.getAvatarUrl().isBlank()) {
            creator.setAvatarUrl(payload.getAvatarUrl().trim());
        }
        if (payload.getPrice() >= 0) {
            creator.setPrice(payload.getPrice());
        }
        if (payload.getCampaignId() != null) {
            creator.setCampaignId(payload.getCampaignId());
            creator.setCampaignName(payload.getCampaignName());
        }
        if (payload.getAudienceFit() > 0) creator.setAudienceFit(payload.getAudienceFit());
        if (payload.getContentQuality() > 0) creator.setContentQuality(payload.getContentQuality());
        if (payload.getAuthenticityRisk() != null && !payload.getAuthenticityRisk().isBlank()) creator.setAuthenticityRisk(payload.getAuthenticityRisk().trim());
        if (payload.getPricingModel() != null && !payload.getPricingModel().isBlank()) creator.setPricingModel(payload.getPricingModel().trim());
        if (payload.getMinPrice() != null) creator.setMinPrice(payload.getMinPrice());
        if (payload.getMaxPrice() != null) creator.setMaxPrice(payload.getMaxPrice());
        creator.setPlatform("Instagram");

        String callerAgencyName = resolveCallerAgencyName(authentication);
        String resolvedAgency = callerAgencyName != null ? callerAgencyName : resolveAgencyName(authentication, payload.getAgencyName() != null ? payload.getAgencyName() : creator.getAgencyName());
        if (existingAgencyIsUnassigned(creator.getAgencyName()) || callerAgencyName == null) {
            creator.setAgencyName(resolvedAgency);
        }

        CreatorEntity saved = creatorRepository.save(creator);

        if (oldHandle != null && !oldHandle.equalsIgnoreCase(saved.getHandle())) {
            List<ContentItemEntity> oldItems = contentItemRepository.findByCreatorHandle(oldHandle);
            for (ContentItemEntity item : oldItems) {
                item.setCreatorHandle(saved.getHandle());
                contentItemRepository.save(item);
            }
        }

        syncSubmittedContentUrls(saved, payload.getContentUrls(), resolvedAgency, payload.getPrice());
        if ("PACKAGE".equalsIgnoreCase(saved.getPricingModel())) {
            rebalancePackageDeliverables(saved.getHandle());
        }
        cacheEvictionService.evictCreators();
        if (callerAgencyName != null) {
            return ResponseEntity.ok(scopeCreatorForAgency(saved, callerAgencyName));
        }
        return ResponseEntity.ok(enrichCreator(saved));
    }

    private boolean existingAgencyIsUnassigned(String agency) {
        return agency == null || agency.isBlank() || "Partner Agency".equalsIgnoreCase(agency.trim());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER')")
    public ResponseEntity<Map<String, String>> deleteCreator(
            @PathVariable Long id,
            Authentication authentication
    ) {
        CreatorEntity creator = creatorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Creator not found"));

        String handle = creator.getHandle();
        String handleNorm = InstagramService.normalizeHandle(handle).toLowerCase();
        String callerAgencyName = resolveCallerAgencyName(authentication);

        if (callerAgencyName != null) {
            // Delete all deliverables submitted by this agency for this creator (case-insensitive handle)
            List<ContentItemEntity> agencyItems = contentItemRepository.findAll().stream()
                    .filter(ci -> ci.getCreatorHandle() != null
                            && InstagramService.normalizeHandle(ci.getCreatorHandle()).equalsIgnoreCase(handleNorm)
                            && callerAgencyName.equalsIgnoreCase(ci.getAgencyName()))
                    .toList();
            if (!agencyItems.isEmpty()) {
                contentItemRepository.deleteAll(agencyItems);
            }

            // Check if any other agencies have deliverables for this creator
            long otherAgencyItems = contentItemRepository.findAll().stream()
                    .filter(ci -> ci.getCreatorHandle() != null
                            && InstagramService.normalizeHandle(ci.getCreatorHandle()).equalsIgnoreCase(handleNorm))
                    .count();

            if (otherAgencyItems == 0 || callerAgencyName.equalsIgnoreCase(creator.getAgencyName())) {
                // Permanently delete creator entity and any residual items
                List<ContentItemEntity> residual = contentItemRepository.findAll().stream()
                        .filter(ci -> ci.getCreatorHandle() != null
                                && InstagramService.normalizeHandle(ci.getCreatorHandle()).equalsIgnoreCase(handleNorm))
                        .toList();
                if (!residual.isEmpty()) {
                    contentItemRepository.deleteAll(residual);
                }
                creatorRepository.delete(creator);
            } else {
                creator.setAgencyName("Partner Agency");
                creatorRepository.save(creator);
                instagramService.rollUpCreatorMetrics(creator.getHandle());
            }
            cacheEvictionService.evictAll();
            return ResponseEntity.ok(Map.of("message", "Creator @" + handleNorm.replaceFirst("^@+", "") + " removed and agency deliverables deleted."));
        }

        // Brand Manager or System Admin: Permanently delete creator and all deliverables across database
        List<ContentItemEntity> allCreatorItems = contentItemRepository.findAll().stream()
                .filter(ci -> ci.getCreatorHandle() != null
                        && InstagramService.normalizeHandle(ci.getCreatorHandle()).equalsIgnoreCase(handleNorm))
                .toList();
        if (!allCreatorItems.isEmpty()) {
            contentItemRepository.deleteAll(allCreatorItems);
        }
        creatorRepository.delete(creator);
        cacheEvictionService.evictAll();
        return ResponseEntity.ok(Map.of("message", "Creator @" + handleNorm.replaceFirst("^@+", "") + " and all deliverables permanently purged."));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleCreatorException(RuntimeException ex) {
        return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage() != null ? ex.getMessage() : "Creator operation failed"));
    }
}
