package com.converge.service;

import com.converge.entity.*;
import com.converge.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
public class BrandService {

    private final BrandRepository brandRepository;
    private final AgencyRepository agencyRepository;
    private final CreatorRepository creatorRepository;
    private final ReelDeliverableRepository reelRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final InstagramGraphService instagramGraphService;
    private final String adminEmail;

    public BrandService(
            BrandRepository brandRepository,
            AgencyRepository agencyRepository,
            CreatorRepository creatorRepository,
            ReelDeliverableRepository reelRepository,
            AuditLogRepository auditLogRepository,
            UserRepository userRepository,
            EmailService emailService,
            InstagramGraphService instagramGraphService,
            @Value("${app.admin.email:}") String adminEmail) {
        this.brandRepository = brandRepository;
        this.agencyRepository = agencyRepository;
        this.creatorRepository = creatorRepository;
        this.reelRepository = reelRepository;
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.instagramGraphService = instagramGraphService;
        this.adminEmail = adminEmail != null ? adminEmail.trim().toLowerCase() : "";
    }

    public List<Brand> listBrands(String status, String search, String managerEmailFilter) {
        List<Brand> all = (managerEmailFilter != null && !managerEmailFilter.isBlank())
                ? brandRepository.findByManagerEmailIgnoreCase(managerEmailFilter)
                : brandRepository.findAllByOrderByCreatedAtDesc();
        return all.stream()
                .filter(b -> status == null || status.isBlank() || status.equalsIgnoreCase("ALL")
                        || b.getStatus().equalsIgnoreCase(status))
                .filter(b -> {
                    if (search == null || search.isBlank()) return true;
                    String q = search.toLowerCase();
                    return (b.getName() != null && b.getName().toLowerCase().contains(q))
                            || (b.getManagerName() != null && b.getManagerName().toLowerCase().contains(q))
                            || (b.getManagerEmail() != null && b.getManagerEmail().toLowerCase().contains(q))
                            || (b.getCode() != null && b.getCode().toLowerCase().contains(q));
                })
                .toList();
    }

    public Brand getBrand(UUID id) {
        return brandRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Brand not found."));
    }

    public Map<String, Object> getBrandOverview(UUID brandId) {
        Brand brand = getBrand(brandId);
        List<Agency> agencies = agencyRepository.findByBrandIdOrderByConnectedAtDesc(brandId);
        List<Creator> creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId);
        List<ReelDeliverable> reels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId);

        long totalReach = creators.stream().mapToLong(Creator::getReachCount).sum();
        double avgEngagement = creators.isEmpty() ? 0.0 :
                creators.stream().mapToDouble(Creator::getEngagementRate).average().orElse(0.0);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("brand", brand);
        result.put("agencies", agencies);
        result.put("creators", creators);
        result.put("recentReels", reels.stream().limit(6).toList());
        result.put("stats", Map.of(
                "totalReels", reels.size(),
                "totalReach", totalReach,
                "avgEngagement", Math.round(avgEngagement * 100.0) / 100.0,
                "activeAgencies", agencies.size(),
                "totalCreators", creators.size()
        ));
        return result;
    }

    private static final java.util.regex.Pattern EMAIL_PATTERN =
            java.util.regex.Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    @Transactional
    public Brand provisionBrand(Map<String, String> payload) {
        String name = payload.getOrDefault("name", "").trim();
        if (name.length() < 2) {
            throw new IllegalArgumentException("Brand organization name must be at least 2 characters.");
        }

        String managerName = payload.getOrDefault("managerName", "").trim();
        if (managerName.length() < 2) {
            throw new IllegalArgumentException("Brand manager name must be at least 2 characters.");
        }

        String managerEmail = payload.getOrDefault("managerEmail", "").trim().toLowerCase();
        validateManagerEmail(managerEmail);

        String contactNumber = payload.getOrDefault("contactNumber", "").trim();
        if (!contactNumber.isEmpty()) {
            String compactPhone = contactNumber.replaceAll("[\\s\\-()]", "");
            if (!compactPhone.matches("^\\+?[0-9]{7,15}$")) {
                throw new IllegalArgumentException("Please enter a valid phone number (7 to 15 digits).");
            }
        }

        String igHandle = payload.getOrDefault("instagramHandle", "").trim();
        if (!igHandle.isEmpty() && !igHandle.matches("^@?[A-Za-z0-9._]{1,30}$")) {
            throw new IllegalArgumentException("Instagram handle can only contain letters, numbers, dots, or underscores.");
        }

        String status = payload.getOrDefault("status", "ACTIVE").toUpperCase();
        if (!status.equals("DRAFT") && !status.equals("ACTIVE")) {
            status = "ACTIVE";
        }

        Brand brand = new Brand();
        brand.setName(name);
        brand.setCode("BRD-" + (10000 + new Random().nextInt(89999)));
        String slugBase = name.toLowerCase().replaceAll("[^a-z0-9]", "");
        brand.setSlug("@" + (slugBase.isEmpty() ? "brand" : slugBase));
        brand.setDomain(slugBase + ".com");
        brand.setManagerName(managerName);
        brand.setManagerEmail(managerEmail);
        brand.setContactNumber(contactNumber);
        brand.setInstagramHandle(igHandle);
        brand.setStatus(status);
        brand.setDescription(payload.getOrDefault("description",
                "Verified brand workspace provisioned on Converge for automated Reel insights and partner governance."));

        userRepository.findByEmailIgnoreCase(managerEmail).ifPresent(u -> brand.setManagerId(u.getId()));

        Brand saved = brandRepository.save(brand);

        recordAudit(saved.getId(), "SYSTEM", "Genesis Workspace Provisioning",
                status.equals("DRAFT") ? "Draft" : "Active",
                "Brand workspace " + saved.getCode() + " provisioned and assigned directly to " + managerEmail + ".",
                "System Admin (Brand Provisioning Scope Only)", "Genesis Record");

        if (!status.equals("DRAFT") && !managerEmail.isEmpty()) {
            emailService.sendBrandWelcomeEmail(managerEmail, managerName, name);
        }

        return saved;
    }

    private void validateManagerEmail(String managerEmail) {
        if (!EMAIL_PATTERN.matcher(managerEmail).matches()) {
            throw new IllegalArgumentException("Please enter a valid Brand Manager email address.");
        }
        if (!adminEmail.isEmpty() && managerEmail.equalsIgnoreCase(adminEmail)) {
            throw new IllegalArgumentException("System Admin email cannot be assigned as a Brand Manager.");
        }
        userRepository.findByEmailIgnoreCase(managerEmail).ifPresent(user -> {
            if ("SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) {
                throw new IllegalArgumentException("System Admin accounts cannot be assigned as Brand Managers.");
            }
        });
    }

    @Transactional
    public Brand updateBrand(UUID brandId, Map<String, String> payload) {
        Brand brand = getBrand(brandId);
        if (payload.containsKey("managerEmail")) {
            String updatedEmail = payload.get("managerEmail").trim().toLowerCase();
            validateManagerEmail(updatedEmail);
            brand.setManagerEmail(updatedEmail);
        }
        if (payload.containsKey("name")) brand.setName(payload.get("name"));
        if (payload.containsKey("domain")) brand.setDomain(payload.get("domain"));
        if (payload.containsKey("region")) brand.setRegion(payload.get("region"));
        if (payload.containsKey("tier")) brand.setTier(payload.get("tier"));
        if (payload.containsKey("description")) brand.setDescription(payload.get("description"));
        if (payload.containsKey("instagramHandle")) brand.setInstagramHandle(payload.get("instagramHandle"));
        if (payload.containsKey("status")) brand.setStatus(payload.get("status").toUpperCase());
        brand.setUpdatedAt(Instant.now());
        Brand saved = brandRepository.save(brand);

        recordAudit(brandId, "SYSTEM", "Brand Workspace Updated", "Updated",
                "Brand profile metadata updated for " + saved.getName() + ".",
                "System Admin", "Profile Governance");
        return saved;
    }

    @Transactional
    public void deleteBrand(UUID brandId) {
        Brand brand = getBrand(brandId);
        reelRepository.deleteByBrandId(brandId);
        creatorRepository.deleteByBrandId(brandId);
        agencyRepository.deleteByBrandId(brandId);
        auditLogRepository.deleteByBrandId(brandId);
        brandRepository.delete(brand);
    }

    public List<Agency> listAgencies(UUID brandId) {
        return agencyRepository.findByBrandIdOrderByConnectedAtDesc(brandId);
    }

    @Transactional
    public Agency addAgency(UUID brandId, Map<String, String> payload) {
        Brand brand = getBrand(brandId);
        String name = payload.getOrDefault("name", "").trim();
        if (name.isEmpty()) throw new IllegalArgumentException("Agency name is required.");

        Agency agency = new Agency();
        agency.setBrandId(brandId);
        agency.setName(name);
        String slug = name.toLowerCase().replaceAll("[^a-z0-9]", "");
        agency.setHandle(payload.getOrDefault("handle", "@" + slug));
        agency.setMonogram(buildMonogram(name));
        agency.setRoleBadge(payload.getOrDefault("roleBadge", "Partner Agency"));
        agency.setScopeDescription(payload.getOrDefault("scopeDescription",
                "Authorized Partner Agency • Creator Roster Management & Campaign Audits"));
        agency.setContactName(payload.getOrDefault("contactName", ""));
        agency.setContactEmail(payload.getOrDefault("contactEmail", ""));
        agency.setStatus("CONNECTED");

        Agency saved = agencyRepository.save(agency);

        recordAudit(brandId, "AGENCY_PERMISSION", "Partner Agency Linked", "Completed",
                "Linked " + saved.getName() + " (" + saved.getRoleBadge() + ") to " + brand.getName() + ".",
                brand.getManagerName() != null ? brand.getManagerName() : "Brand Owner",
                "Dual-Token Handshake");
        return saved;
    }

    @Transactional
    public Agency updateAgencyPermissions(UUID brandId, UUID agencyId, Map<String, String> payload) {
        Agency agency = agencyRepository.findById(agencyId)
                .orElseThrow(() -> new IllegalArgumentException("Agency not found."));
        if (payload.containsKey("roleBadge")) agency.setRoleBadge(payload.get("roleBadge"));
        if (payload.containsKey("scopeDescription")) agency.setScopeDescription(payload.get("scopeDescription"));
        if (payload.containsKey("status")) agency.setStatus(payload.get("status"));
        Agency saved = agencyRepository.save(agency);

        recordAudit(brandId, "AGENCY_PERMISSION", "Agency Permissions Updated", "Updated",
                "Scoped reach & campaign access updated for " + saved.getName() + ".",
                "Brand Owner", "Role: " + saved.getRoleBadge());
        return saved;
    }

    public List<Creator> listCreators(UUID brandId, String type, String agencyName, String search) {
        return creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId).stream()
                .filter(c -> type == null || type.isBlank() || type.equalsIgnoreCase("all")
                        || c.getSourceType().equalsIgnoreCase(type))
                .filter(c -> agencyName == null || agencyName.isBlank() || agencyName.equalsIgnoreCase("all")
                        || (c.getAgencyName() != null && c.getAgencyName().equalsIgnoreCase(agencyName)))
                .filter(c -> {
                    if (search == null || search.isBlank()) return true;
                    String q = search.toLowerCase();
                    return c.getName().toLowerCase().contains(q)
                            || c.getHandle().toLowerCase().contains(q)
                            || (c.getNiche() != null && c.getNiche().toLowerCase().contains(q))
                            || (c.getAgencyName() != null && c.getAgencyName().toLowerCase().contains(q));
                })
                .toList();
    }

    @Transactional
    public Creator addDirectCreator(UUID brandId, Map<String, String> payload) {
        Brand brand = getBrand(brandId);
        String name = payload.getOrDefault("name", "").trim();
        String handle = InstagramGraphService.normalizeHandle(payload.getOrDefault("handle", ""));
        if (handle.isEmpty()) {
            throw new IllegalArgumentException("Valid Instagram creator handle is required.");
        }
        if (creatorRepository.findByBrandIdAndHandleIgnoreCase(brandId, handle).isPresent()) {
            throw new IllegalArgumentException("Creator " + handle + " is already in this brand's roster.");
        }

        Creator creator = new Creator();
        creator.setBrandId(brandId);
        creator.setName(name.isEmpty() ? InstagramGraphService.stripAt(handle) : name);
        creator.setHandle(handle);
        creator.setProfileUrl("https://www.instagram.com/" + InstagramGraphService.stripAt(handle) + "/");
        creator.setEmail(payload.getOrDefault("email", ""));
        creator.setNiche(payload.getOrDefault("niche", "Direct / Independent"));
        creator.setBio(payload.getOrDefault("bio", ""));
        creator.setSourceType("DIRECT");
        creator.setAgencyName("Direct / Independent");
        creator.setCampaignName(payload.getOrDefault("campaignName", ""));
        creator.setCategory(payload.getOrDefault("category", payload.getOrDefault("niche", "")));
        creator.setManagementHandle(InstagramGraphService.normalizeHandle(payload.getOrDefault("managementHandle", "")));
        creator.setCountry(payload.getOrDefault("country", ""));
        creator.setGender(payload.getOrDefault("gender", ""));
        creator.setAgeBracket(payload.getOrDefault("ageBracket", ""));
        creator.setCreatorTraits(payload.getOrDefault("creatorTraits", ""));
        creator.setPreviousBrandPartners(payload.getOrDefault("previousBrandPartners", ""));
        String mode = payload.getOrDefault("costMode", "COLLECTIVE").trim();
        creator.setCostMode(mode);
        Double cost = parseNullablePositiveDouble(payload.get("costQuoted"));
        if (cost != null) {
            creator.setCostQuoted(cost);
        }
        String curr = payload.getOrDefault("currency", "").trim();
        if (!curr.isEmpty()) creator.setCurrency(curr.toUpperCase(Locale.ROOT));
        if ("true".equalsIgnoreCase(payload.getOrDefault("verified", "false"))) {
            creator.setVerified(true);
        }
        creator.setFollowersDisplay(payload.getOrDefault("followersDisplay", "—"));
        creator.setFollowersCount(0);
        creator.setReachCount(0);
        creator.setEngagementRate(0.0);
        creator.setStatus("ACTIVE_VERIFIED");

        boolean igSynced = instagramGraphService.applyProfileIfAvailable(creator);
        if (!name.isEmpty()) {
            creator.setName(name);
        }
        instagramGraphService.evaluateCreatorQualification(creator);

        Creator saved = creatorRepository.save(creator);

        recordAudit(brandId, "CREATOR_LINK", "Direct Creator Associated", "Completed",
                saved.getName() + " (" + saved.getHandle() + ") added to workspace"
                        + (igSynced ? " with live Meta profile metrics (" + saved.getFollowersDisplay() + " followers)." : "."),
                brand.getManagerName() != null ? brand.getManagerName() : "Brand Manager",
                igSynced ? "Meta Business Discovery" : "Direct Roster");
        return saved;
    }

    public List<ReelDeliverable> listCreatorDeliverables(UUID creatorId) {
        return reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
    }

    @Transactional
    public ReelDeliverable addReelDeliverable(UUID creatorId, Map<String, String> payload) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        String reelUrl = payload.getOrDefault("reelUrl", "").trim();
        if (reelUrl.isEmpty() || InstagramGraphService.extractShortcode(reelUrl) == null) {
            throw new IllegalArgumentException("Enter a valid public Instagram Reel or Post URL (e.g. https://www.instagram.com/reel/...).");
        }
        if (reelRepository.findByCreatorIdAndReelUrlIgnoreCase(creatorId, reelUrl).isPresent()) {
            throw new IllegalArgumentException("This Reel URL has already been submitted for " + creator.getHandle() + ".");
        }

        String title = payload.getOrDefault("title", "Campaign Reel Deliverable").trim();
        if (title.isEmpty()) title = "Campaign Reel Deliverable";

        ReelDeliverable reel = new ReelDeliverable();
        reel.setBrandId(creator.getBrandId());
        reel.setCreatorId(creator.getId());
        reel.setCreatorHandle(creator.getHandle());
        reel.setTitle(title);
        reel.setReelUrl(reelUrl);
        Double delCost = parseNullablePositiveDouble(payload.get("costQuoted"));
        if (delCost != null) {
            reel.setCostQuoted(delCost);
        }

        instagramGraphService.syncReelDeliverable(reel, creator);

        ReelDeliverable saved = reelRepository.save(reel);
        rollUpCreatorMetrics(creator);

        long displayReach = saved.getReachCount() > 0 ? saved.getReachCount() : saved.getViewsCount();
        recordAudit(creator.getBrandId(), "REEL_AUDIT",
                "VERIFIED".equals(saved.getStatus()) ? "Instagram Reel Verified" : "Reel Queued for Meta Sync",
                "VERIFIED".equals(saved.getStatus()) ? "Verified" : "Pending Meta API",
                "VERIFIED".equals(saved.getStatus())
                        ? "Verified Reel (" + title + ") for " + creator.getHandle() + " via " + saved.getMetricsSource()
                        + " (" + displayReach + " reach/views, " + saved.getLikesCount() + " likes)."
                        : "Saved Reel (" + title + ") for " + creator.getHandle() + " (" + saved.getMetricsSource() + ").",
                "Instagram Engine", saved.getMetricsSource());

        return saved;
    }

    @Transactional
    public Map<String, Object> getCreatorInsights(UUID creatorId) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        List<ReelDeliverable> reels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
        List<Map<String, Object>> recentMedia = loadRecentMediaSafe(creator);

        boolean anyReelUpdated = false;
        if (!reels.isEmpty()) {
            for (ReelDeliverable r : reels) {
                String sc = r.getShortcode() != null ? r.getShortcode() : InstagramGraphService.extractShortcode(r.getReelUrl());
                boolean matchedRecent = false;
                if (sc != null && !recentMedia.isEmpty()) {
                    for (Map<String, Object> m : recentMedia) {
                        String mSc = String.valueOf(m.getOrDefault("shortcode", ""));
                        if (sc.equals(mSc)) {
                            matchedRecent = true;
                            if (instagramGraphService.backfillDeliverableFromMedia(r, m, creator.getFollowersCount())) {
                                anyReelUpdated = true;
                            }
                            break;
                        }
                    }
                }
                if (!matchedRecent && r.getViewsCount() == 0
                        && (instagramGraphService.isBusinessDiscoveryConfigured() || creator.isIgConnected())) {
                    instagramGraphService.syncReelDeliverable(r, creator);
                    anyReelUpdated = true;
                }
            }
            if (anyReelUpdated) {
                reelRepository.saveAll(reels);
            }
        }

        creator = rollUpCreatorMetrics(creator, reels);
        return enrichCreatorSummary(creator, reels, recentMedia);
    }

    private Map<String, Object> enrichCreatorSummary(
            Creator creator,
            List<ReelDeliverable> reels,
            List<Map<String, Object>> recentMedia) {
        Map<String, Object> summary = new LinkedHashMap<>(instagramGraphService.buildCreatorInsightsSummary(creator, reels, recentMedia));
        summary.put("recentMedia", recentMedia);

        Set<UUID> brandIds = new LinkedHashSet<>();
        if (creator.getBrandId() != null) brandIds.add(creator.getBrandId());
        if (creator.getHandle() != null && !creator.getHandle().isBlank()) {
            for (Creator linked : creatorRepository.findByHandleIgnoreCase(creator.getHandle())) {
                if (linked.getBrandId() != null) brandIds.add(linked.getBrandId());
            }
        }
        List<String> associatedBrands = new ArrayList<>();
        if (!brandIds.isEmpty()) {
            Map<UUID, String> namesById = new LinkedHashMap<>();
            for (Brand b : brandRepository.findAllById(brandIds)) {
                if (b.getId() != null && b.getName() != null && !b.getName().isBlank()) {
                    namesById.put(b.getId(), b.getName());
                }
            }
            for (UUID bid : brandIds) {
                String nm = namesById.get(bid);
                if (nm != null && !associatedBrands.contains(nm)) {
                    associatedBrands.add(nm);
                }
            }
        }
        summary.put("associatedBrands", associatedBrands);
        return summary;
    }

    @Transactional
    public Map<String, Object> getDeliverableInsights(UUID deliverableId) {
        ReelDeliverable reel = reelRepository.findById(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("Deliverable not found."));
        Creator creator = creatorRepository.findById(reel.getCreatorId())
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));

        List<ReelDeliverable> allCreatorReels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creator.getId());
        if (reel.getViewsCount() == 0
                && (instagramGraphService.isBusinessDiscoveryConfigured() || creator.isIgConnected())) {
            instagramGraphService.syncReelDeliverable(reel, creator);
            reel = reelRepository.save(reel);
            creator = rollUpCreatorMetrics(creator);
        }
        return instagramGraphService.buildDeliverableInsightsSummary(reel, creator, allCreatorReels.size());
    }

    private List<Map<String, Object>> loadRecentMediaSafe(Creator creator) {
        if (!instagramGraphService.isBusinessDiscoveryConfigured() && !creator.isIgConnected()) {
            return List.of();
        }
        try {
            String token = creator.isIgConnected() ? creator.getIgAccessToken() : null;
            return instagramGraphService.fetchRecentMedia(creator.getHandle(), 25, token);
        } catch (Exception ex) {
            return List.of();
        }
    }

    @Transactional
    public Map<String, Object> updateCreatorInsightsProfile(UUID creatorId, Map<String, Object> payload) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));

        // Only allowed CRM/commercial metadata is editable; IG metrics & Category remain non-editable.
        if (payload.containsKey("campaignName")) creator.setCampaignName(strVal(payload.get("campaignName")));
        if (payload.containsKey("managementHandle")) {
            String rawMgmt = strVal(payload.get("managementHandle"));
            creator.setManagementHandle(rawMgmt.isEmpty() ? "" : InstagramGraphService.normalizeHandle(rawMgmt));
        }
        if (payload.containsKey("country")) creator.setCountry(strVal(payload.get("country")));
        if (payload.containsKey("creatorTraits")) creator.setCreatorTraits(strListOrString(payload.get("creatorTraits")));
        if (payload.containsKey("previousBrandPartners")) creator.setPreviousBrandPartners(strListOrString(payload.get("previousBrandPartners")));
        if (payload.containsKey("costMode")) {
            creator.setCostMode(strVal(payload.get("costMode")));
        }
        if (payload.containsKey("costQuoted")) {
            creator.setCostQuoted(parseNullablePositiveDouble(payload.get("costQuoted")));
        }
        if (payload.containsKey("currency")) {
            String curr = strVal(payload.get("currency"));
            if (!curr.isEmpty()) creator.setCurrency(curr.toUpperCase(Locale.ROOT));
        }

        instagramGraphService.evaluateCreatorQualification(creator);
        Creator saved = creatorRepository.save(creator);

        recordAudit(creator.getBrandId(), "CREATOR_LINK", "Creator Profile & Rate Updated", "Updated",
                "Updated non-metric CRM / commercial metadata for " + creator.getHandle() + ".",
                "Workspace Manager", saved.getInsightsSource());

        List<ReelDeliverable> reels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
        List<Map<String, Object>> recentMedia = loadRecentMediaSafe(saved);
        return enrichCreatorSummary(saved, reels, recentMedia);
    }

    @Transactional
    public Map<String, Object> syncCreatorFromInstagram(UUID creatorId) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        boolean profileUpdated = instagramGraphService.applyProfileIfAvailable(creator);
        List<ReelDeliverable> reels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
        int verifiedCount = 0;
        for (ReelDeliverable r : reels) {
            instagramGraphService.syncReelDeliverable(r, creator);
            if ("VERIFIED".equals(r.getStatus())) verifiedCount++;
        }
        reelRepository.saveAll(reels);
        Creator updated = rollUpCreatorMetrics(creator);

        recordAudit(creator.getBrandId(), "REEL_AUDIT", "Creator Instagram Sync",
                verifiedCount > 0 || profileUpdated ? "Synced" : "Pending Meta API",
                "Refreshed " + creator.getHandle() + " (" + verifiedCount + "/" + reels.size() + " deliverables verified).",
                "Instagram Engine", instagramGraphService.isBusinessDiscoveryConfigured() ? "Meta Graph API" : "Pending Credentials");

        List<Map<String, Object>> recentMedia = loadRecentMediaSafe(updated);
        Map<String, Object> out = enrichCreatorSummary(updated, reels, recentMedia);
        out.put("profileUpdated", profileUpdated);
        out.put("verifiedDeliverables", verifiedCount);
        out.put("metaConfigured", instagramGraphService.isBusinessDiscoveryConfigured() || creator.isIgConnected());
        return out;
    }

    @Transactional
    public ReelDeliverable updateDeliverable(UUID deliverableId, Map<String, Object> payload) {
        ReelDeliverable reel = reelRepository.findById(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("Deliverable not found."));
        if (payload.containsKey("title")) {
            String title = strVal(payload.get("title"));
            if (!title.isEmpty()) reel.setTitle(title);
        }
        if (payload.containsKey("costQuoted")) {
            reel.setCostQuoted(parseNullablePositiveDouble(payload.get("costQuoted")));
        }
        ReelDeliverable saved = reelRepository.save(reel);
        creatorRepository.findById(saved.getCreatorId()).ifPresent(this::rollUpCreatorMetrics);
        recordAudit(saved.getBrandId(), "REEL_AUDIT", "Deliverable Updated", "Updated",
                "Updated deliverable (" + saved.getTitle() + ") metadata/pricing.",
                "Workspace Manager", "Deliverables");
        return saved;
    }

    @Transactional
    public ReelDeliverable syncDeliverableFromInstagram(UUID deliverableId) {
        ReelDeliverable reel = reelRepository.findById(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("Deliverable not found."));
        Creator creator = creatorRepository.findById(reel.getCreatorId())
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        instagramGraphService.syncReelDeliverable(reel, creator);
        ReelDeliverable saved = reelRepository.save(reel);
        rollUpCreatorMetrics(creator);
        return saved;
    }

    @Transactional
    public void deleteCreator(UUID creatorId) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        List<ReelDeliverable> reels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
        if (!reels.isEmpty()) {
            reelRepository.deleteAll(reels);
        }
        creatorRepository.delete(creator);
        recordAudit(creator.getBrandId(), "CREATOR_LINK", "Creator Removed", "Removed",
                "Removed " + creator.getName() + " (" + creator.getHandle() + ") and associated deliverables.",
                "Workspace Manager", "Roster Management");
    }

    @Transactional
    public void deleteDeliverable(UUID deliverableId) {
        ReelDeliverable reel = reelRepository.findById(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("Deliverable not found."));
        UUID creatorId = reel.getCreatorId();
        reelRepository.delete(reel);
        creatorRepository.findById(creatorId).ifPresent(this::rollUpCreatorMetrics);
    }

    @Transactional
    public Creator attachCreatorOAuthProfile(UUID creatorId, Map<String, Object> oauthProfile) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        creator.setIgConnected(true);
        creator.setIgAccessToken((String) oauthProfile.get("accessToken"));
        creator.setIgTokenExpiresAt((Instant) oauthProfile.get("expiresAt"));
        if (oauthProfile.get("igUserId") != null) creator.setIgUserId(String.valueOf(oauthProfile.get("igUserId")));
        if (oauthProfile.get("accountType") != null) creator.setAccountType(String.valueOf(oauthProfile.get("accountType")));
        if (oauthProfile.get("avatarUrl") instanceof String av && !av.isBlank()) creator.setAvatarUrl(av);
        if (oauthProfile.get("followersCount") instanceof Number fc && fc.longValue() > 0) {
            creator.setFollowersCount(fc.longValue());
            creator.setFollowersDisplay(InstagramGraphService.formatCompactNumber(fc.longValue()));
        }
        if (oauthProfile.get("followsCount") instanceof Number flc) creator.setFollowsCount(flc.longValue());
        if (oauthProfile.get("mediaCount") instanceof Number mc) creator.setMediaCount(mc.longValue());
        creator.setLastSyncedAt(Instant.now());
        Creator saved = creatorRepository.save(creator);

        recordAudit(creator.getBrandId(), "CREATOR_LINK", "Instagram OAuth Connected", "Connected",
                "Creator " + creator.getHandle() + " connected official Instagram Insights access.",
                creator.getName(), "Instagram OAuth");
        return saved;
    }

    @Transactional
    public Map<String, Object> syncBrandDeliverables(UUID brandId) {
        Brand brand = getBrand(brandId);
        List<Creator> creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId);
        Map<UUID, Creator> creatorMap = new LinkedHashMap<>();
        for (Creator c : creators) {
            instagramGraphService.applyProfileIfAvailable(c);
            creatorMap.put(c.getId(), c);
        }

        List<ReelDeliverable> reels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId);
        int verifiedCount = 0;
        int pendingCount = 0;
        for (ReelDeliverable r : reels) {
            Creator c = creatorMap.get(r.getCreatorId());
            instagramGraphService.syncReelDeliverable(r, c);
            if ("VERIFIED".equals(r.getStatus())) {
                verifiedCount++;
            } else {
                pendingCount++;
            }
        }
        reelRepository.saveAll(reels);
        for (Creator c : creators) {
            rollUpCreatorMetrics(c);
        }

        Instant now = Instant.now();
        brand.setUpdatedAt(now);
        brandRepository.save(brand);

        boolean configured = instagramGraphService.isBusinessDiscoveryConfigured()
                || creators.stream().anyMatch(Creator::isIgConnected);

        recordAudit(brandId, "REEL_AUDIT", "Live API Deliverables Sync",
                configured ? "Verified" : "Pending Meta API",
                verifiedCount + " verified, " + pendingCount + " pending across " + creators.size() + " creators.",
                "Instagram Engine", configured ? "Meta Graph API" : "Credentials Needed");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("syncedCount", reels.size());
        out.put("verifiedCount", verifiedCount);
        out.put("pendingCount", pendingCount);
        out.put("metaConfigured", configured);
        out.put("status", configured ? "SYNCED" : "PENDING_META_CREDENTIALS");
        out.put("syncedAt", now.toString());
        return out;
    }

    private Creator rollUpCreatorMetrics(Creator creator) {
        List<ReelDeliverable> items = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creator.getId());
        return rollUpCreatorMetrics(creator, items);
    }

    private Creator rollUpCreatorMetrics(Creator creator, List<ReelDeliverable> items) {
        List<ReelDeliverable> safeItems = items != null ? items : List.of();
        long totalViews = safeItems.stream()
                .mapToLong(ReelDeliverable::getViewsCount)
                .sum();
        long totalInteractions = safeItems.stream()
                .mapToLong(r -> r.getLikesCount() + r.getCommentsCount())
                .sum();
        double trackedIrPct = (creator.getFollowersCount() > 0 && totalInteractions > 0)
                ? Math.round((totalInteractions * 100.0 / creator.getFollowersCount()) * 100.0) / 100.0
                : 0.0;

        creator.setAuditedReelsCount(safeItems.size());
        creator.setReachCount(totalViews);
        creator.setTotalViews30d(totalViews);
        creator.setAccountInteractions30d(totalInteractions);
        creator.setInteractionRate90d(trackedIrPct);
        creator.setEngagementRate(trackedIrPct);
        instagramGraphService.evaluateCreatorQualification(creator);
        creator.setLastSyncedAt(Instant.now());
        return creatorRepository.save(creator);
    }

    public Map<String, Object> listAuditLogs(UUID brandId, String category, String search, int page, int size) {
        List<AuditLog> filtered = auditLogRepository.findByBrandIdOrderByCreatedAtDesc(brandId).stream()
                .filter(l -> category == null || category.isBlank() || category.equalsIgnoreCase("ALL")
                        || l.getCategory().equalsIgnoreCase(category))
                .filter(l -> {
                    if (search == null || search.isBlank()) return true;
                    String q = search.toLowerCase();
                    return l.getEventCode().toLowerCase().contains(q)
                            || l.getTitle().toLowerCase().contains(q)
                            || l.getDescription().toLowerCase().contains(q)
                            || (l.getActor() != null && l.getActor().toLowerCase().contains(q));
                })
                .toList();

        int total = filtered.size();
        int from = Math.min(page * size, total);
        int to = Math.min(from + size, total);

        return Map.of(
                "items", filtered.subList(from, to),
                "total", total,
                "page", page,
                "size", size
        );
    }

    public String exportBrandCsv(UUID brandId) {
        Brand brand = getBrand(brandId);
        List<Creator> creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId);
        List<ReelDeliverable> allReels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId);
        Map<UUID, List<ReelDeliverable>> deliverablesByCreator = new HashMap<>();
        for (ReelDeliverable r : allReels) {
            deliverablesByCreator.computeIfAbsent(r.getCreatorId(), k -> new ArrayList<>()).add(r);
        }
        StringBuilder sb = new StringBuilder();
        sb.append("Brand,Code,Creator,Handle,Tier,Category,ManagementHandle,Country,Followers,AccountInteractions,Views,InteractionRate,CostMode,CostQuoted,Verified,PreviousPartners,Source,Agency,Campaign,AuditedReels,EngagementRate,Status\n");
        for (Creator c : creators) {
            Double exportedCost;
            if ("PER_DELIVERABLE".equals(c.getCostMode())) {
                double sum = 0.0;
                for (ReelDeliverable r : deliverablesByCreator.getOrDefault(c.getId(), List.of())) {
                    Double dc = (r.getCostQuoted() != null && r.getCostQuoted() > 0) ? r.getCostQuoted() : c.getCostQuoted();
                    if (dc != null && dc > 0) sum += dc;
                }
                exportedCost = sum > 0 ? sum : null;
            } else {
                exportedCost = c.getCostQuoted();
            }
            sb.append(csv(brand.getName())).append(',')
              .append(csv(brand.getCode())).append(',')
              .append(csv(c.getName())).append(',')
              .append(csv(c.getHandle())).append(',')
              .append(csv(InstagramGraphService.computeFollowerTier(c.getFollowersCount()))).append(',')
              .append(csv(c.getCategory())).append(',')
              .append(csv(c.getManagementHandle())).append(',')
              .append(csv(c.getCountry())).append(',')
              .append(c.getFollowersCount()).append(',')
              .append(c.getAccountInteractions30d()).append(',')
              .append(c.getTotalViews30d()).append(',')
              .append(c.getInteractionRate90d()).append("%,")
              .append(csv(c.getCostMode())).append(',')
              .append(exportedCost != null && exportedCost > 0 ? exportedCost : "").append(',')
              .append(c.isVerified()).append(',')
              .append(csv(c.getPreviousBrandPartners())).append(',')
              .append(csv(c.getSourceType())).append(',')
              .append(csv(c.getAgencyName())).append(',')
              .append(csv(c.getCampaignName())).append(',')
              .append(c.getAuditedReelsCount()).append(',')
              .append(c.getEngagementRate()).append("%,")
              .append(csv(c.getStatus())).append('\n');
        }
        return sb.toString();
    }

    private Double parseNullablePositiveDouble(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) {
            double d = n.doubleValue();
            return d > 0 ? d : null;
        }
        String raw = String.valueOf(v).replaceAll("[,\\s₹$]", "").trim();
        if (raw.isEmpty()) return null;
        try {
            double d = Double.parseDouble(raw);
            return d > 0 ? d : null;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Cost quoted must be a valid positive number.");
        }
    }

    private String strVal(Object v) {
        return v != null ? String.valueOf(v).trim() : "";
    }

    private String strListOrString(Object v) {
        if (v instanceof Collection<?> col) {
            return col.stream().map(this::strVal).filter(s -> !s.isEmpty()).reduce((a, b) -> a + ", " + b).orElse("");
        }
        return strVal(v);
    }

    private void recordAudit(UUID brandId, String category, String title, String badge,
                             String description, String actor, String tag) {
        AuditLog log = new AuditLog();
        log.setBrandId(brandId);
        log.setCategory(category);
        log.setTitle(title);
        log.setStatusBadge(badge);
        log.setDescription(description);
        log.setActor(actor);
        log.setMetadataTag(tag);
        log.setEventCode("EVT-" + (1000 + new Random().nextInt(8999)) + "-" + category.substring(0, 2));
        log.setSha256Hash(sha256(brandId + title + Instant.now()));
        auditLogRepository.save(log);
    }

    private String buildMonogram(String name) {
        String[] parts = name.trim().split("\\s+");
        if (parts.length >= 2) {
            return ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return name.substring(0, Math.min(2, name.length())).toUpperCase();
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            return UUID.randomUUID().toString().replace("-", "");
        }
    }

    private String csv(String v) {
        if (v == null) return "";
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }
}
