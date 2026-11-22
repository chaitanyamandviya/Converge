package com.converge.service;

import com.converge.entity.*;
import com.converge.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class BrandService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Set<String> VALID_BRAND_STATUSES = Set.of("ACTIVE", "DRAFT", "PENDING");
    private static final java.util.regex.Pattern EMAIL_PATTERN =
            java.util.regex.Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final BrandRepository brandRepository;
    private final AgencyRepository agencyRepository;
    private final CreatorRepository creatorRepository;
    private final ReelDeliverableRepository reelRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final InstagramGraphService instagramGraphService;
    private final ReelSnapshotRepository reelSnapshotRepository;
    private final SharedReportRepository sharedReportRepository;
    private final CampaignRepository campaignRepository;
    private final CampaignCreatorRepository campaignCreatorRepository;
    private final String adminEmail;
    private static final long AUTO_SYNC_COOLDOWN_SECONDS = 60L;
    private final java.util.concurrent.ConcurrentHashMap<String, Instant> recentSyncTimestamps =
            new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.concurrent.atomic.AtomicBoolean scheduledSyncRunning =
            new java.util.concurrent.atomic.AtomicBoolean(false);
    @Value("${app.instagram.auto-sync.enabled:true}")
    private boolean autoSyncEnabled = true;

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
        this(brandRepository, agencyRepository, creatorRepository, reelRepository,
                auditLogRepository, userRepository, emailService, instagramGraphService,
                null, null, null, null, adminEmail);
    }

    public BrandService(
            BrandRepository brandRepository,
            AgencyRepository agencyRepository,
            CreatorRepository creatorRepository,
            ReelDeliverableRepository reelRepository,
            AuditLogRepository auditLogRepository,
            UserRepository userRepository,
            EmailService emailService,
            InstagramGraphService instagramGraphService,
            ReelSnapshotRepository reelSnapshotRepository,
            @Value("${app.admin.email:}") String adminEmail) {
        this(brandRepository, agencyRepository, creatorRepository, reelRepository,
                auditLogRepository, userRepository, emailService, instagramGraphService,
                reelSnapshotRepository, null, null, null, adminEmail);
    }

    @Autowired
    public BrandService(
            BrandRepository brandRepository,
            AgencyRepository agencyRepository,
            CreatorRepository creatorRepository,
            ReelDeliverableRepository reelRepository,
            AuditLogRepository auditLogRepository,
            UserRepository userRepository,
            EmailService emailService,
            InstagramGraphService instagramGraphService,
            ReelSnapshotRepository reelSnapshotRepository,
            SharedReportRepository sharedReportRepository,
            CampaignRepository campaignRepository,
            CampaignCreatorRepository campaignCreatorRepository,
            @Value("${app.admin.email:}") String adminEmail) {
        this.brandRepository = brandRepository;
        this.agencyRepository = agencyRepository;
        this.creatorRepository = creatorRepository;
        this.reelRepository = reelRepository;
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.instagramGraphService = instagramGraphService;
        this.reelSnapshotRepository = reelSnapshotRepository;
        this.sharedReportRepository = sharedReportRepository;
        this.campaignRepository = campaignRepository;
        this.campaignCreatorRepository = campaignCreatorRepository;
        this.adminEmail = adminEmail != null ? adminEmail.trim().toLowerCase() : "";
    }

    public boolean isAdmin(Authentication auth) {
        return auth != null && auth.isAuthenticated() && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SYSTEM_ADMIN".equals(a.getAuthority()));
    }

    public void requireAdmin(Authentication auth) {
        if (!isAdmin(auth)) {
            throw new AccessDeniedException("Only System Admin can perform this action.");
        }
    }

    public Brand requireBrandAccess(UUID brandId, Authentication auth) {
        Brand brand = getBrand(brandId);
        if (isAdmin(auth)) {
            return brand;
        }
        if (!hasBrandAccess(brand, auth)) {
            throw new AccessDeniedException("You do not have access to this brand workspace.");
        }
        return brand;
    }

    public Brand requireBrandOwnerAccess(UUID brandId, Authentication auth) {
        Brand brand = getBrand(brandId);
        if (isAdmin(auth) || hasBrandOwnerAccess(brand, auth)) {
            return brand;
        }
        throw new AccessDeniedException("Only the Brand Manager or System Admin can manage partner agencies for this brand.");
    }

    public Creator requireCreatorAccess(UUID creatorId, Authentication auth) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        Brand brand = requireBrandAccess(creator.getBrandId(), auth);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        if (scopedAgency.isPresent() && !creatorBelongsToAgency(creator, scopedAgency.get())) {
            throw new AccessDeniedException("You only have access to creators onboarded by your agency.");
        }
        return creator;
    }

    public ReelDeliverable requireDeliverableAccess(UUID deliverableId, Authentication auth) {
        ReelDeliverable reel = reelRepository.findById(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("Deliverable not found."));
        if (reel.getCreatorId() != null) {
            requireCreatorAccess(reel.getCreatorId(), auth);
        } else {
            requireBrandAccess(reel.getBrandId(), auth);
        }
        return reel;
    }

    public static boolean isAgencyManagedCreator(Creator creator) {
        return creator != null
                && ("AGENCY".equalsIgnoreCase(creator.getSourceType()) || creator.getAgencyId() != null);
    }

    /**
     * Deliverables and creator profile settings for agency-added creators are managed solely
     * by the partner agency. Brand Managers and Admins retain view and delete access only.
     */
    public Creator requireCreatorManagementAccess(UUID creatorId, Authentication auth) {
        Creator creator = requireCreatorAccess(creatorId, auth);
        if (isAgencyManagedCreator(creator)) {
            Brand brand = getBrand(creator.getBrandId());
            Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
            if (scopedAgency.isEmpty()) {
                throw new AccessDeniedException(
                        "Deliverables and creator settings for agency-added creators are managed by the partner agency. Brand access is view and delete only.");
            }
        }
        return creator;
    }

    public ReelDeliverable requireDeliverableManagementAccess(UUID deliverableId, Authentication auth) {
        ReelDeliverable reel = requireDeliverableAccess(deliverableId, auth);
        if (reel.getCreatorId() != null) {
            requireCreatorManagementAccess(reel.getCreatorId(), auth);
        }
        return reel;
    }

    public Optional<Agency> resolveScopedAgencyForCaller(Brand brand, Authentication auth) {
        if (brand == null || brand.getId() == null
                || auth == null || !auth.isAuthenticated() || auth.getName() == null || auth.getName().isBlank()) {
            return Optional.empty();
        }
        if (isAdmin(auth) || hasBrandOwnerAccess(brand, auth)) {
            return Optional.empty();
        }
        String callerEmail = auth.getName().trim().toLowerCase(Locale.ROOT);
        return agencyRepository.findByBrandIdOrderByConnectedAtDesc(brand.getId()).stream()
                .filter(a -> a.getContactEmail() != null
                        && a.getContactEmail().equalsIgnoreCase(callerEmail)
                        && !"DRAFT".equalsIgnoreCase(a.getStatus()))
                .findFirst();
    }

    public static boolean creatorBelongsToAgency(Creator creator, Agency agency) {
        if (creator == null || agency == null) return false;
        if (agency.getId() != null && agency.getId().equals(creator.getAgencyId())) {
            return true;
        }
        return creator.getAgencyId() == null
                && "AGENCY".equalsIgnoreCase(creator.getSourceType())
                && agency.getName() != null
                && agency.getName().equalsIgnoreCase(creator.getAgencyName());
    }

    public String resolveActor(Authentication auth, String fallback) {
        if (auth != null && auth.getName() != null && !auth.getName().isBlank()) {
            return auth.getName().trim().toLowerCase(Locale.ROOT);
        }
        return fallback;
    }

    private boolean hasBrandOwnerAccess(Brand brand, Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null || auth.getName().isBlank()) {
            return false;
        }
        if (isAdmin(auth)) {
            return true;
        }
        if ("DRAFT".equalsIgnoreCase(brand.getStatus())) {
            return false;
        }
        String callerEmail = auth.getName().trim().toLowerCase(Locale.ROOT);
        if (brand.getManagerEmail() == null || !brand.getManagerEmail().equalsIgnoreCase(callerEmail)) {
            return false;
        }
        UUID callerUid = extractAuthUserId(auth);
        if (brand.getManagerId() != null) {
            return callerUid != null && brand.getManagerId().equals(callerUid);
        }
        // Unclaimed invited workspace (managerId == null): allow only verified sessions
        return isAuthVerified(auth);
    }

    private boolean hasActiveAgencyAccess(Brand brand, String callerEmail) {
        if (brand == null || brand.getId() == null || "DRAFT".equalsIgnoreCase(brand.getStatus())
                || callerEmail == null || callerEmail.isBlank()) {
            return false;
        }
        return agencyRepository.findByBrandIdOrderByConnectedAtDesc(brand.getId()).stream()
                .anyMatch(a -> a.getContactEmail() != null
                        && a.getContactEmail().equalsIgnoreCase(callerEmail)
                        && !"DRAFT".equalsIgnoreCase(a.getStatus()));
    }

    private boolean hasBrandAccess(Brand brand, Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null || auth.getName().isBlank()) {
            return false;
        }
        if (isAdmin(auth)) {
            return true;
        }
        if ("DRAFT".equalsIgnoreCase(brand.getStatus())) {
            return false;
        }
        if (hasBrandOwnerAccess(brand, auth)) {
            return true;
        }
        String callerEmail = auth.getName().trim().toLowerCase(Locale.ROOT);
        return hasActiveAgencyAccess(brand, callerEmail);
    }

    private UUID extractAuthUserId(Authentication auth) {
        if (auth.getDetails() instanceof Map<?, ?> details && details.get("uid") instanceof UUID id) {
            return id;
        }
        return userRepository.findByEmailIgnoreCase(auth.getName().trim())
                .map(User::getId)
                .orElse(null);
    }

    private boolean isAuthVerified(Authentication auth) {
        if (auth.getDetails() instanceof Map<?, ?> details && details.get("verified") instanceof Boolean v) {
            return v;
        }
        return userRepository.findByEmailIgnoreCase(auth.getName().trim())
                .map(User::isVerified)
                .orElse(true);
    }

    public List<Brand> listBrands(String status, String search, String managerEmailFilter) {
        List<Brand> all = (managerEmailFilter != null && !managerEmailFilter.isBlank())
                ? brandRepository.findByManagerEmailIgnoreCase(managerEmailFilter)
                : brandRepository.findAllByOrderByCreatedAtDesc();
        return filterBrands(all, status, search);
    }

    public List<Brand> listBrandsForCaller(String status, String search, Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new AccessDeniedException("Authentication required.");
        }
        List<Brand> scoped;
        if (isAdmin(auth)) {
            scoped = brandRepository.findAllByOrderByCreatedAtDesc();
        } else {
            String callerEmail = auth.getName().trim().toLowerCase(Locale.ROOT);
            Map<UUID, Brand> accessible = new LinkedHashMap<>();
            for (Brand b : brandRepository.findByManagerEmailIgnoreCase(callerEmail)) {
                if (b.getId() != null && hasBrandOwnerAccess(b, auth)) {
                    accessible.put(b.getId(), b);
                }
            }
            List<Agency> callerAgencies = agencyRepository.findByContactEmailIgnoreCase(callerEmail);
            if (callerAgencies != null && !callerAgencies.isEmpty()) {
                Set<UUID> agencyBrandIds = new LinkedHashSet<>();
                for (Agency ag : callerAgencies) {
                    if (ag.getBrandId() != null && !"DRAFT".equalsIgnoreCase(ag.getStatus())) {
                        agencyBrandIds.add(ag.getBrandId());
                    }
                }
                if (!agencyBrandIds.isEmpty()) {
                    for (Brand b : brandRepository.findAllById(agencyBrandIds)) {
                        if (b.getId() != null && !"DRAFT".equalsIgnoreCase(b.getStatus())) {
                            accessible.putIfAbsent(b.getId(), b);
                        }
                    }
                }
            }
            scoped = List.copyOf(accessible.values());
        }
        return filterBrands(scoped, status, search);
    }

    private List<Brand> filterBrands(List<Brand> source, String status, String search) {
        return source.stream()
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
        return getBrandOverview(brandId, null);
    }

    @Transactional
    public Map<String, Object> getBrandOverview(UUID brandId, Authentication auth) {
        Brand brand = getBrand(brandId);
        ensureLegacyCampaignsMigrated(brandId);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        List<Agency> agencies;
        List<Creator> creators;
        List<ReelDeliverable> reels;
        if (scopedAgency.isPresent()) {
            Agency ag = scopedAgency.get();
            agencies = List.of(ag);
            creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId).stream()
                    .filter(c -> creatorBelongsToAgency(c, ag))
                    .toList();
            Set<UUID> allowedCreatorIds = new HashSet<>();
            for (Creator c : creators) {
                if (c.getId() != null) allowedCreatorIds.add(c.getId());
            }
            reels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId).stream()
                    .filter(r -> r.getCreatorId() != null && allowedCreatorIds.contains(r.getCreatorId()))
                    .toList();
        } else {
            agencies = agencyRepository.findByBrandIdOrderByConnectedAtDesc(brandId);
            creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId);
            reels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId);
        }

        long totalReach = creators.stream().mapToLong(Creator::getReachCount).sum();
        double avgEngagement = creators.isEmpty() ? 0.0 :
                creators.stream().mapToDouble(Creator::getEngagementRate).average().orElse(0.0);
        InstagramGraphService.HookRateRollup brandHook = InstagramGraphService.computeViewWeightedHookRate(reels);

        Map<String, Object> brandStats = new LinkedHashMap<>();
        brandStats.put("totalReels", reels.size());
        brandStats.put("totalReach", totalReach);
        brandStats.put("avgEngagement", Math.round(avgEngagement * 100.0) / 100.0);
        brandStats.put("avgHookRatePct", brandHook.avgHookRatePct());
        brandStats.put("hookMeasuredReelsCount", brandHook.measuredReelsCount());
        brandStats.put("activeAgencies", agencies.size());
        brandStats.put("totalCreators", creators.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("brand", brand);
        result.put("agencies", agencies);
        result.put("creators", creators);
        result.put("recentReels", reels.stream().limit(6).toList());
        result.put("deliverables", reels);
        result.put("campaigns", buildCampaignSummariesList(brandId, scopedAgency, creators, reels));
        result.put("reelDeltas", buildBrandReelDeltasMap(brandId, reels));
        result.put("stats", brandStats);
        return result;
    }

    @Transactional
    public Brand provisionBrand(Map<String, String> payload) {
        return provisionBrand(payload, "Admin");
    }

    @Transactional
    public Brand provisionBrand(Map<String, String> payload, String actor) {
        if (payload == null) {
            throw new IllegalArgumentException("Brand payload is required.");
        }
        String name = strVal(payload.get("name"));
        if (name.length() < 2) {
            throw new IllegalArgumentException("Brand organization name must be at least 2 characters.");
        }
        if (!brandRepository.findAllByNameIgnoreCase(name).isEmpty()) {
            throw new IllegalArgumentException("A brand named \"" + name + "\" already exists.");
        }

        String managerName = strVal(payload.get("managerName"));
        if (managerName.length() < 2) {
            throw new IllegalArgumentException("Brand manager name must be at least 2 characters.");
        }

        String managerEmail = strVal(payload.get("managerEmail")).toLowerCase(Locale.ROOT);
        validateManagerEmail(managerEmail);

        String contactNumber = strVal(payload.get("contactNumber"));
        if (!contactNumber.isEmpty()) {
            String compactPhone = contactNumber.replaceAll("[\\s\\-()]", "");
            if (!compactPhone.matches("^\\+?[0-9]{7,15}$")) {
                throw new IllegalArgumentException("Please enter a valid phone number (7 to 15 digits).");
            }
        }

        String igHandle = strVal(payload.get("instagramHandle"));
        if (!igHandle.isEmpty() && !igHandle.matches("^@?[A-Za-z0-9._]{1,30}$")) {
            throw new IllegalArgumentException("Instagram handle can only contain letters, numbers, dots, or underscores.");
        }

        String rawStatus = strVal(payload.get("status"));
        String status = rawStatus.isEmpty() ? "ACTIVE" : rawStatus.toUpperCase(Locale.ROOT);
        if (!status.equals("DRAFT") && !status.equals("ACTIVE")) {
            status = "ACTIVE";
        }

        Brand brand = new Brand();
        brand.setName(name);
        brand.setCode("BRD-" + (10000 + ThreadLocalRandom.current().nextInt(89999)));
        String slugBase = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        brand.setSlug("@" + (slugBase.isEmpty() ? "brand" : slugBase));
        brand.setDomain(slugBase + ".com");
        brand.setManagerName(managerName);
        brand.setManagerEmail(managerEmail);
        brand.setContactNumber(contactNumber);
        brand.setInstagramHandle(igHandle);
        brand.setStatus(status);
        String desc = strVal(payload.get("description"));
        brand.setDescription(desc.isEmpty()
                ? "Verified brand workspace provisioned on Converge for automated Reel insights and partner governance."
                : desc);

        String rawActivationToken = null;
        Optional<User> existingManager = userRepository.findByEmailIgnoreCase(managerEmail);
        if (existingManager.isPresent()) {
            brand.setManagerId(existingManager.get().getId());
        } else {
            rawActivationToken = generateRawActivationToken();
            brand.setActivationToken(AuthService.sha256Hex(rawActivationToken));
        }

        Brand saved = brandRepository.save(brand);

        recordAudit(saved.getId(), "SYSTEM",
                status.equals("DRAFT") ? "Brand Saved as Draft" : "Brand Created",
                status.equals("DRAFT") ? "Draft" : "Active",
                "Workspace created for " + saved.getName() + " and assigned to " + managerName + " (" + managerEmail + ").",
                actor != null && !actor.isBlank() ? actor : "Admin", "Brand Setup");

        if (!status.equals("DRAFT") && !managerEmail.isEmpty()) {
            final String tokenForEmail = rawActivationToken;
            dispatchAfterCommit(() -> emailService.sendBrandWelcomeEmail(managerEmail, managerName, name, tokenForEmail));
        }

        return saved;
    }

    private static String generateRawActivationToken() {
        byte[] bytes = new byte[24];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static void dispatchAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
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
        return updateBrand(brandId, payload, "Admin");
    }

    @Transactional
    public Brand updateBrand(UUID brandId, Map<String, String> payload, String actor) {
        if (payload == null) {
            throw new IllegalArgumentException("Brand update payload is required.");
        }
        Brand brand = getBrand(brandId);
        if (payload.get("name") != null) {
            String nextName = payload.get("name").trim();
            if (nextName.length() < 2) {
                throw new IllegalArgumentException("Brand organization name must be at least 2 characters.");
            }
            boolean duplicate = brandRepository.findAllByNameIgnoreCase(nextName).stream()
                    .anyMatch(other -> !other.getId().equals(brandId));
            if (duplicate) {
                throw new IllegalArgumentException("A brand named \"" + nextName + "\" already exists.");
            }
            brand.setName(nextName);
        }
        if (payload.get("managerName") != null) {
            String nextManager = payload.get("managerName").trim();
            if (nextManager.length() < 2) {
                throw new IllegalArgumentException("Brand manager name must be at least 2 characters.");
            }
            brand.setManagerName(nextManager);
        }
        if (payload.get("managerEmail") != null) {
            String updatedEmail = payload.get("managerEmail").trim().toLowerCase(Locale.ROOT);
            validateManagerEmail(updatedEmail);
            boolean emailChanged = brand.getManagerEmail() == null || !brand.getManagerEmail().equalsIgnoreCase(updatedEmail);
            brand.setManagerEmail(updatedEmail);
            Optional<User> existingMgr = userRepository.findByEmailIgnoreCase(updatedEmail);
            if (existingMgr.isPresent()) {
                brand.setManagerId(existingMgr.get().getId());
                brand.setActivationToken(null);
            } else if (emailChanged || brand.getActivationToken() == null) {
                brand.setManagerId(null);
                brand.setActivationToken(AuthService.sha256Hex(generateRawActivationToken()));
            }
        }
        if (payload.get("contactNumber") != null) {
            String contactNumber = payload.get("contactNumber").trim();
            if (!contactNumber.isEmpty()) {
                String compactPhone = contactNumber.replaceAll("[\\s\\-()]", "");
                if (!compactPhone.matches("^\\+?[0-9]{7,15}$")) {
                    throw new IllegalArgumentException("Please enter a valid phone number (7 to 15 digits).");
                }
            }
            brand.setContactNumber(contactNumber);
        }
        if (payload.get("domain") != null) brand.setDomain(payload.get("domain").trim());
        if (payload.get("region") != null) brand.setRegion(payload.get("region").trim());
        if (payload.get("tier") != null) brand.setTier(payload.get("tier").trim());
        if (payload.get("description") != null) brand.setDescription(payload.get("description").trim());
        if (payload.get("instagramHandle") != null) {
            String igHandle = payload.get("instagramHandle").trim();
            if (!igHandle.isEmpty() && !igHandle.matches("^@?[A-Za-z0-9._]{1,30}$")) {
                throw new IllegalArgumentException("Instagram handle can only contain letters, numbers, dots, or underscores.");
            }
            brand.setInstagramHandle(igHandle);
        }
        if (payload.get("status") != null) {
            String nextStatus = payload.get("status").trim().toUpperCase(Locale.ROOT);
            if (!VALID_BRAND_STATUSES.contains(nextStatus)) {
                throw new IllegalArgumentException("Invalid brand status. Allowed values: ACTIVE, DRAFT, PENDING.");
            }
            brand.setStatus(nextStatus);
        }
        brand.setUpdatedAt(Instant.now());
        Brand saved = brandRepository.save(brand);

        recordAudit(brandId, "SYSTEM", "Brand Details Updated", "Updated",
                "Updated brand profile and manager details for " + saved.getName() + ".",
                actor != null && !actor.isBlank() ? actor : "Admin", "Brand Details");
        return saved;
    }

    @Transactional
    public void deleteBrand(UUID brandId) {
        Brand brand = getBrand(brandId);
        if (campaignCreatorRepository != null) {
            campaignCreatorRepository.deleteByBrandId(brandId);
        }
        if (campaignRepository != null) {
            campaignRepository.deleteByBrandId(brandId);
        }
        if (sharedReportRepository != null) {
            sharedReportRepository.deleteByBrandId(brandId);
        }
        if (reelSnapshotRepository != null) {
            reelSnapshotRepository.deleteByBrandId(brandId);
        }
        reelRepository.deleteByBrandId(brandId);
        creatorRepository.deleteByBrandId(brandId);
        agencyRepository.deleteByBrandId(brandId);
        auditLogRepository.deleteByBrandId(brandId);
        brandRepository.delete(brand);
    }

    public List<Agency> listAgencies(UUID brandId) {
        return listAgencies(brandId, null);
    }

    public List<Agency> listAgencies(UUID brandId, Authentication auth) {
        Optional<Agency> scopedAgency = (auth != null)
                ? resolveScopedAgencyForCaller(getBrand(brandId), auth)
                : Optional.empty();
        if (scopedAgency.isPresent()) {
            return List.of(scopedAgency.get());
        }
        return agencyRepository.findByBrandIdOrderByConnectedAtDesc(brandId);
    }

    @Transactional
    public Agency addAgency(UUID brandId, Map<String, String> payload) {
        return addAgency(brandId, payload, null);
    }

    @Transactional
    public Agency addAgency(UUID brandId, Map<String, String> payload, String actor) {
        Brand brand = getBrand(brandId);
        if (payload == null) {
            throw new IllegalArgumentException("Agency payload is required.");
        }
        String name = strVal(payload.get("name"));
        if (name.length() < 2) {
            throw new IllegalArgumentException("Agency organization name must be at least 2 characters.");
        }
        if (!agencyRepository.findByBrandIdAndNameIgnoreCase(brandId, name).isEmpty()) {
            throw new IllegalArgumentException("An agency named \"" + name + "\" is already linked to this brand.");
        }

        String contactName = strVal(payload.containsKey("contactName") ? payload.get("contactName") : payload.get("managerName"));
        if (contactName.length() < 2) {
            throw new IllegalArgumentException("Agency manager name must be at least 2 characters.");
        }

        String contactEmail = strVal(payload.containsKey("contactEmail") ? payload.get("contactEmail") : payload.get("managerEmail")).toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(contactEmail).matches()) {
            throw new IllegalArgumentException("Please enter a valid Agency manager email address.");
        }

        String contactNumber = validateContactNumber(strVal(payload.get("contactNumber")));

        String rawStatus = strVal(payload.get("status")).toUpperCase(Locale.ROOT);
        String status = "DRAFT".equals(rawStatus) ? "DRAFT" : "CONNECTED";

        Agency agency = new Agency();
        agency.setBrandId(brandId);
        agency.setName(name);
        String slug = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        String rawHandle = strVal(payload.get("handle"));
        agency.setHandle(rawHandle.isEmpty() ? "@" + (slug.isEmpty() ? "agency" : slug) : rawHandle);
        agency.setMonogram(buildMonogram(name));
        String roleBadge = strVal(payload.get("roleBadge"));
        agency.setRoleBadge(roleBadge.isEmpty() ? "Partner Agency" : roleBadge);
        String scopeDesc = strVal(payload.get("scopeDescription"));
        agency.setScopeDescription(scopeDesc.isEmpty()
                ? "Authorized Partner Agency • Creator Roster Management & Campaign Audits"
                : scopeDesc);
        agency.setContactName(contactName);
        agency.setContactEmail(contactEmail);
        agency.setContactNumber(contactNumber);
        agency.setStatus(status);

        Agency saved = agencyRepository.save(agency);
        if (!"DRAFT".equalsIgnoreCase(saved.getStatus()) && saved.getContactEmail() != null && !saved.getContactEmail().isBlank()) {
            userRepository.findByEmailIgnoreCase(saved.getContactEmail()).ifPresent(existingUser -> {
                if (!existingUser.isVerified()) {
                    existingUser.setVerified(true);
                    userRepository.save(existingUser);
                }
            });
        }

        recordAudit(brandId, saved.getId(), "AGENCY_PERMISSION",
                "DRAFT".equals(status) ? "Agency Saved as Draft" : "Partner Agency Linked",
                "DRAFT".equals(status) ? "Draft" : "Connected",
                saved.getName() + " assigned to " + contactName + " (" + contactEmail + ") for " + brand.getName() + ".",
                actor != null && !actor.isBlank() ? actor : (brand.getManagerName() != null ? brand.getManagerName() : "Brand Manager"),
                "Partner Agency");
        return saved;
    }

    @Transactional
    public Agency updateAgencyPermissions(UUID brandId, UUID agencyId, Map<String, String> payload) {
        return updateAgencyPermissions(brandId, agencyId, payload, "Brand Owner");
    }

    @Transactional
    public Agency updateAgencyPermissions(UUID brandId, UUID agencyId, Map<String, String> payload, String actor) {
        Agency agency = agencyRepository.findById(agencyId)
                .orElseThrow(() -> new IllegalArgumentException("Agency not found."));
        if (!brandId.equals(agency.getBrandId())) {
            throw new AccessDeniedException("Agency does not belong to this brand workspace.");
        }
        if (payload != null) {
            if (payload.get("name") != null) {
                String nextName = payload.get("name").trim();
                if (nextName.length() < 2) {
                    throw new IllegalArgumentException("Agency organization name must be at least 2 characters.");
                }
                boolean duplicate = agencyRepository.findByBrandIdAndNameIgnoreCase(brandId, nextName).stream()
                        .anyMatch(other -> !other.getId().equals(agencyId));
                if (duplicate) {
                    throw new IllegalArgumentException("An agency named \"" + nextName + "\" is already linked to this brand.");
                }
                if (!nextName.equals(agency.getName())) {
                    agency.setName(nextName);
                    agency.setMonogram(buildMonogram(nextName));
                    String slug = nextName.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
                    agency.setHandle("@" + (slug.isEmpty() ? "agency" : slug));
                    List<Creator> linkedCreators = creatorRepository.findByAgencyId(agencyId);
                    if (!linkedCreators.isEmpty()) {
                        for (Creator c : linkedCreators) {
                            c.setAgencyName(nextName);
                        }
                        creatorRepository.saveAll(linkedCreators);
                    }
                }
            }
            String mgrNameKey = payload.containsKey("contactName") ? "contactName" : (payload.containsKey("managerName") ? "managerName" : null);
            if (mgrNameKey != null && payload.get(mgrNameKey) != null) {
                String nextMgr = payload.get(mgrNameKey).trim();
                if (nextMgr.length() < 2) {
                    throw new IllegalArgumentException("Agency manager name must be at least 2 characters.");
                }
                agency.setContactName(nextMgr);
            }
            String mgrEmailKey = payload.containsKey("contactEmail") ? "contactEmail" : (payload.containsKey("managerEmail") ? "managerEmail" : null);
            if (mgrEmailKey != null && payload.get(mgrEmailKey) != null) {
                String nextEmail = payload.get(mgrEmailKey).trim().toLowerCase(Locale.ROOT);
                if (!EMAIL_PATTERN.matcher(nextEmail).matches()) {
                    throw new IllegalArgumentException("Please enter a valid Agency manager email address.");
                }
                agency.setContactEmail(nextEmail);
            }
            if (payload.get("contactNumber") != null) {
                agency.setContactNumber(validateContactNumber(payload.get("contactNumber").trim()));
            }
            if (payload.get("roleBadge") != null) agency.setRoleBadge(payload.get("roleBadge").trim());
            if (payload.get("scopeDescription") != null) agency.setScopeDescription(payload.get("scopeDescription").trim());
            if (payload.get("status") != null) {
                String st = payload.get("status").trim().toUpperCase(Locale.ROOT);
                if ("ACTIVE".equals(st)) st = "CONNECTED";
                if (!Set.of("CONNECTED", "DRAFT", "PENDING").contains(st)) {
                    throw new IllegalArgumentException("Invalid agency status.");
                }
                agency.setStatus(st);
            }
        }
        Agency saved = agencyRepository.save(agency);
        if (!"DRAFT".equalsIgnoreCase(saved.getStatus()) && saved.getContactEmail() != null && !saved.getContactEmail().isBlank()) {
            userRepository.findByEmailIgnoreCase(saved.getContactEmail()).ifPresent(existingUser -> {
                if (!existingUser.isVerified()) {
                    existingUser.setVerified(true);
                    userRepository.save(existingUser);
                }
            });
        }

        recordAudit(brandId, saved.getId(), "AGENCY_PERMISSION", "Agency Details Updated", "Updated",
                "Updated agency profile and manager details for " + saved.getName() + ".",
                actor != null && !actor.isBlank() ? actor : "Brand Owner", "Agency Details");
        return saved;
    }

    @Transactional
    public void deleteAgency(UUID brandId, UUID agencyId, String actor) {
        Agency agency = agencyRepository.findById(agencyId)
                .orElseThrow(() -> new IllegalArgumentException("Agency not found."));
        if (!brandId.equals(agency.getBrandId())) {
            throw new AccessDeniedException("Agency does not belong to this brand workspace.");
        }
        List<Creator> linkedCreators = creatorRepository.findByAgencyId(agencyId);
        if (!linkedCreators.isEmpty()) {
            for (Creator c : linkedCreators) {
                c.setAgencyId(null);
                c.setSourceType("DIRECT");
                c.setAgencyName("Direct / Independent");
            }
            creatorRepository.saveAll(linkedCreators);
        }
        agencyRepository.delete(agency);
        recordAudit(brandId, "AGENCY_PERMISSION", "Partner Agency Removed", "Removed",
                "Removed partner agency " + agency.getName() + ".",
                actor != null && !actor.isBlank() ? actor : "Brand Manager", "Partner Agency");
    }

    private static String validateContactNumber(String contactNumber) {
        if (contactNumber == null || contactNumber.isBlank()) {
            return "";
        }
        String trimmed = contactNumber.trim();
        String compactPhone = trimmed.replaceAll("[\\s\\-()]", "");
        if (!compactPhone.matches("^\\+?[0-9]{7,15}$")) {
            throw new IllegalArgumentException("Please enter a valid phone number (7 to 15 digits).");
        }
        return trimmed;
    }

    public List<Creator> listCreators(UUID brandId, String type, String agencyName, String search) {
        return listCreators(brandId, type, agencyName, search, null);
    }

    public List<Creator> listCreators(UUID brandId, String type, String agencyName, String search, Authentication auth) {
        Optional<Agency> scopedAgency = (auth != null)
                ? resolveScopedAgencyForCaller(getBrand(brandId), auth)
                : Optional.empty();
        return creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId).stream()
                .filter(c -> scopedAgency.isEmpty() || creatorBelongsToAgency(c, scopedAgency.get()))
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

    public Creator addDirectCreator(UUID brandId, Map<String, String> payload) {
        return addDirectCreator(brandId, payload, null);
    }

    public Creator addDirectCreator(UUID brandId, Map<String, String> payload, String actor) {
        Brand brand = getBrand(brandId);
        if (payload == null) {
            throw new IllegalArgumentException("Creator details payload is required.");
        }
        String name = strVal(payload.get("name"));
        String handle = InstagramGraphService.normalizeHandle(strVal(payload.get("handle")));
        if (handle.isEmpty() || !InstagramGraphService.isValidHandle(handle)) {
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
        creator.setEmail(strVal(payload.get("email")));
        String niche = strVal(payload.get("niche"));
        creator.setBio(strVal(payload.get("bio")));
        Agency matchedAgency = null;
        if (actor != null && !actor.isBlank()
                && (brand.getManagerEmail() == null || !brand.getManagerEmail().equalsIgnoreCase(actor.trim()))) {
            String callerEmail = actor.trim().toLowerCase(Locale.ROOT);
            matchedAgency = agencyRepository.findByBrandIdOrderByConnectedAtDesc(brandId).stream()
                    .filter(a -> a.getContactEmail() != null
                            && a.getContactEmail().equalsIgnoreCase(callerEmail)
                            && !"DRAFT".equalsIgnoreCase(a.getStatus()))
                    .findFirst()
                    .orElse(null);
        }
        String defaultCategory;
        if (matchedAgency != null) {
            creator.setSourceType("AGENCY");
            creator.setAgencyId(matchedAgency.getId());
            creator.setAgencyName(matchedAgency.getName());
            defaultCategory = matchedAgency.getName();
        } else {
            creator.setSourceType("DIRECT");
            creator.setAgencyName("Direct / Independent");
            defaultCategory = "Direct / Independent";
        }
        creator.setNiche(niche.isEmpty() ? defaultCategory : niche);
        creator.setCampaignName(strVal(payload.get("campaignName")));
        String category = strVal(payload.get("category"));
        creator.setCategory(category.isEmpty() ? (niche.isEmpty() ? defaultCategory : niche) : category);
        creator.setManagementHandle(InstagramGraphService.normalizeHandle(strVal(payload.get("managementHandle"))));
        creator.setCountry(strVal(payload.get("country")));
        creator.setGender(strVal(payload.get("gender")));
        creator.setAgeBracket(strVal(payload.get("ageBracket")));
        creator.setCreatorTraits(strVal(payload.get("creatorTraits")));
        creator.setPreviousBrandPartners(strVal(payload.get("previousBrandPartners")));
        String mode = strVal(payload.get("costMode"));
        creator.setCostMode(mode.isEmpty() ? "COLLECTIVE" : mode);
        Double cost = parseNullablePositiveDouble(payload.get("costQuoted"));
        if (cost != null) {
            creator.setCostQuoted(cost);
        }
        String curr = strVal(payload.get("currency"));
        if (!curr.isEmpty()) creator.setCurrency(curr.toUpperCase(Locale.ROOT));
        if ("true".equalsIgnoreCase(strVal(payload.get("verified")))) {
            creator.setVerified(true);
        }
        String fDisplay = strVal(payload.get("followersDisplay"));
        creator.setFollowersDisplay(fDisplay.isEmpty() ? "—" : fDisplay);
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
        if (matchedAgency != null && matchedAgency.getId() != null) {
            int updatedCount = creatorRepository.findByAgencyId(matchedAgency.getId()).size();
            matchedAgency.setCreatorsCount(Math.max(1, updatedCount));
            agencyRepository.save(matchedAgency);
        }

        recordAudit(brandId, matchedAgency != null ? matchedAgency.getId() : null, "CREATOR_LINK", "Creator Added", "Completed",
                saved.getName() + " (" + saved.getHandle() + ") added to " + brand.getName()
                        + (igSynced ? " (" + saved.getFollowersDisplay() + " followers)." : "."),
                actor != null && !actor.isBlank() ? actor : (brand.getManagerName() != null ? brand.getManagerName() : "Brand Manager"),
                "Creator Roster");
        return saved;
    }

    public List<ReelDeliverable> listCreatorDeliverables(UUID creatorId) {
        return reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
    }

    public ReelDeliverable addReelDeliverable(UUID creatorId, Map<String, String> payload) {
        return addReelDeliverable(creatorId, payload, "Brand Manager");
    }

    public ReelDeliverable addReelDeliverable(UUID creatorId, Map<String, String> payload, String actor) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        String reelUrl = strVal(payload != null ? payload.get("reelUrl") : null);
        String shortcode = InstagramGraphService.extractShortcode(reelUrl);
        if (reelUrl.isEmpty() || shortcode == null) {
            throw new IllegalArgumentException("Enter a valid public https://www.instagram.com/reel/... or Post URL.");
        }
        String normalizedIncoming = normalizeReelUrl(reelUrl);
        List<ReelDeliverable> existingReels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
        for (ReelDeliverable existing : existingReels) {
            String existingSc = existing.getShortcode() != null && !existing.getShortcode().isBlank()
                    ? existing.getShortcode()
                    : InstagramGraphService.extractShortcode(existing.getReelUrl());
            if ((existingSc != null && existingSc.equalsIgnoreCase(shortcode))
                    || normalizeReelUrl(existing.getReelUrl()).equalsIgnoreCase(normalizedIncoming)) {
                throw new IllegalArgumentException("This Reel is already added to " + creator.getHandle() + "'s tracked deliverables.");
            }
        }
        if (reelRepository.findByCreatorIdAndReelUrlIgnoreCase(creatorId, reelUrl).isPresent()) {
            throw new IllegalArgumentException("This Reel is already added to " + creator.getHandle() + "'s tracked deliverables.");
        }

        String title = trimToMax(strVal(payload.get("title")), 160);
        if (title.isEmpty()) title = "Campaign Reel Deliverable";
        Campaign resolvedCamp = resolveCampaignForDeliverable(
                creator.getBrandId(),
                strVal(payload.get("campaignId")),
                strVal(payload.get("campaignTag")),
                creator.getCampaignName(),
                actor,
                false
        );
        String campaignTag = resolvedCamp != null
                ? resolvedCamp.getName()
                : trimToMax(strVal(payload.get("campaignTag")), 80);
        if (campaignTag.isEmpty() && creator.getCampaignName() != null && !creator.getCampaignName().isBlank()) {
            campaignTag = trimToMax(creator.getCampaignName().trim(), 80);
        }

        ReelDeliverable reel = new ReelDeliverable();
        reel.setBrandId(creator.getBrandId());
        reel.setCreatorId(creator.getId());
        reel.setCreatorHandle(creator.getHandle());
        reel.setTitle(title);
        reel.setReelUrl(reelUrl);
        reel.setShortcode(shortcode);
        reel.setCampaignId(resolvedCamp != null ? resolvedCamp.getId() : null);
        reel.setCampaignTag(campaignTag);
        Double delCost = parseNullablePositiveDouble(payload.get("costQuoted"));
        if (delCost != null) {
            reel.setCostQuoted(delCost);
        }

        if (!creator.isDemoData()) {
            instagramGraphService.syncReelDeliverable(reel, creator);
        } else {
            reel.setStatus("PENDING_META_SYNC");
        }
        applyManualHookRateFromPayload(reel, payload);

        ReelDeliverable saved = reelRepository.save(reel);
        if (resolvedCamp != null) {
            ensureCampaignCreatorLinked(resolvedCamp.getId(), creator.getBrandId(), creator.getId(), creator.isDemoData(), 1, null);
        }
        recordDeliverableSnapshotIfChanged(saved, false);
        rollUpCreatorMetrics(creator);

        long displayReach = saved.getReachCount() > 0 ? saved.getReachCount() : saved.getViewsCount();
        recordAudit(creator.getBrandId(), creator.getAgencyId(), "REEL_AUDIT",
                "VERIFIED".equals(saved.getStatus()) ? "Reel Verified" : "Reel Saved",
                "VERIFIED".equals(saved.getStatus()) ? "Verified" : "Saved",
                "VERIFIED".equals(saved.getStatus())
                        ? "\"" + title + "\" for " + creator.getHandle() + " (" + displayReach + " views, " + saved.getLikesCount() + " likes)."
                        : "Added \"" + title + "\" for " + creator.getHandle() + ".",
                actor != null && !actor.isBlank() ? actor : "Brand Manager", "Reels");

        return saved;
    }

    public Map<String, Object> getCreatorInsights(UUID creatorId) {
        return getCreatorInsights(creatorId, true, null);
    }

    public Map<String, Object> getCreatorInsights(UUID creatorId, boolean includeAllBrands, String callerEmail) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        List<ReelDeliverable> reels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
        List<Map<String, Object>> recentMedia = creator.isDemoData() ? List.of() : loadRecentMediaSafe(creator);

        boolean anyReelUpdated = false;
        Instant staleCutoff = Instant.now().minusSeconds(600);
        if (!reels.isEmpty() && !creator.isDemoData()) {
            for (ReelDeliverable r : reels) {
                String sc = r.getShortcode() != null ? r.getShortcode() : InstagramGraphService.extractShortcode(r.getReelUrl());
                boolean matchedRecent = false;
                if (sc != null && !recentMedia.isEmpty()) {
                    for (Map<String, Object> m : recentMedia) {
                        String mSc = String.valueOf(m.getOrDefault("shortcode", ""));
                        if (sc.equals(mSc)) {
                            matchedRecent = true;
                            ensureBaselineSnapshotBeforeSync(r);
                            if (instagramGraphService.backfillDeliverableFromMedia(r, m, creator.getFollowersCount())) {
                                anyReelUpdated = true;
                            }
                            break;
                        }
                    }
                }
                boolean needsInitialSync = !matchedRecent
                        && !r.isDemoData()
                        && r.getViewsCount() == 0
                        && !isStaticPhotoType(r.getMediaType())
                        && !"NOT_FOUND".equals(r.getStatus())
                        && (r.getSyncedAt() == null || r.getSyncedAt().isBefore(staleCutoff));
                if (needsInitialSync && (instagramGraphService.isBusinessDiscoveryConfigured() || creator.isIgConnected())) {
                    ensureBaselineSnapshotBeforeSync(r);
                    instagramGraphService.syncReelDeliverable(r, creator);
                    anyReelUpdated = true;
                }
            }
            if (anyReelUpdated) {
                List<ReelDeliverable> savedReels = reelRepository.saveAll(reels);
                List<ReelDeliverable> snapReels = (savedReels != null && !savedReels.isEmpty()) ? savedReels : reels;
                for (ReelDeliverable r : snapReels) {
                    recordDeliverableSnapshotIfChanged(r, false);
                }
            }
        }

        creator = rollUpCreatorMetrics(creator, reels);
        return enrichCreatorSummary(creator, reels, recentMedia, includeAllBrands, callerEmail);
    }

    private Map<String, Object> enrichCreatorSummary(
            Creator creator,
            List<ReelDeliverable> reels,
            List<Map<String, Object>> recentMedia,
            boolean includeAllBrands,
            String callerEmail) {
        Map<String, Object> summary = new LinkedHashMap<>(instagramGraphService.buildCreatorInsightsSummary(creator, reels, recentMedia));
        summary.put("recentMedia", recentMedia);

        Set<UUID> brandIds = new LinkedHashSet<>();
        if (creator.getBrandId() != null) brandIds.add(creator.getBrandId());
        if (includeAllBrands && creator.getHandle() != null && !creator.getHandle().isBlank()) {
            for (Creator linked : creatorRepository.findByHandleIgnoreCase(creator.getHandle())) {
                if (linked.getBrandId() != null) brandIds.add(linked.getBrandId());
            }
        } else if (callerEmail != null && !callerEmail.isBlank() && creator.getHandle() != null && !creator.getHandle().isBlank()) {
            for (Creator linked : creatorRepository.findByHandleIgnoreCase(creator.getHandle())) {
                if (linked.getBrandId() != null) brandIds.add(linked.getBrandId());
            }
        }
        List<String> associatedBrands = new ArrayList<>();
        if (!brandIds.isEmpty()) {
            Map<UUID, String> namesById = new LinkedHashMap<>();
            for (Brand b : brandRepository.findAllById(brandIds)) {
                boolean allowed = includeAllBrands
                        || (creator.getBrandId() != null && creator.getBrandId().equals(b.getId()))
                        || (callerEmail != null && !callerEmail.isBlank() && callerEmail.equalsIgnoreCase(b.getManagerEmail()));
                if (allowed && b.getId() != null && b.getName() != null && !b.getName().isBlank()) {
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

    public Map<String, Object> getDeliverableInsights(UUID deliverableId) {
        ReelDeliverable reel = reelRepository.findById(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("Deliverable not found."));
        Creator creator = creatorRepository.findById(reel.getCreatorId())
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));

        List<ReelDeliverable> allCreatorReels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creator.getId());
        Instant staleCutoff = Instant.now().minusSeconds(600);
        boolean shouldSync = !reel.isDemoData()
                && !creator.isDemoData()
                && reel.getViewsCount() == 0
                && !isStaticPhotoType(reel.getMediaType())
                && !"VERIFIED".equals(reel.getStatus())
                && (reel.getSyncedAt() == null || reel.getSyncedAt().isBefore(staleCutoff));
        if (shouldSync
                && (instagramGraphService.isBusinessDiscoveryConfigured() || creator.isIgConnected())) {
            ensureBaselineSnapshotBeforeSync(reel);
            instagramGraphService.syncReelDeliverable(reel, creator);
            reel = reelRepository.save(reel);
            recordDeliverableSnapshotIfChanged(reel, false);
            creator = rollUpCreatorMetrics(creator, allCreatorReels);
        } else {
            recordDeliverableSnapshotIfChanged(reel, false);
        }
        Map<String, Object> summary = instagramGraphService.buildDeliverableInsightsSummary(reel, creator, allCreatorReels.size());
        attachSnapshotHistory(summary, reel);
        return summary;
    }

    private List<Map<String, Object>> loadRecentMediaSafe(Creator creator) {
        if (!instagramGraphService.isBusinessDiscoveryConfigured() && !creator.isIgConnected()) {
            return List.of();
        }
        try {
            String token = creator.isIgConnected() ? creator.getIgAccessToken() : null;
            int targetLimit = creator.getMediaCount() > 50 ? 100 : 50;
            return instagramGraphService.fetchRecentMedia(creator.getHandle(), targetLimit, token);
        } catch (Exception ex) {
            return List.of();
        }
    }

    public Map<String, Object> updateCreatorInsightsProfile(UUID creatorId, Map<String, Object> payload) {
        return updateCreatorInsightsProfile(creatorId, payload, true, null, "Workspace Manager");
    }

    public Map<String, Object> updateCreatorInsightsProfile(
            UUID creatorId,
            Map<String, Object> payload,
            boolean includeAllBrands,
            String callerEmail,
            String actor) {
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

        recordAudit(creator.getBrandId(), creator.getAgencyId(), "CREATOR_LINK", "Creator Details Updated", "Updated",
                "Updated profile and rate details for " + creator.getHandle() + ".",
                actor != null && !actor.isBlank() ? actor : "Workspace Manager", "Creator Profile");

        List<ReelDeliverable> reels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
        List<Map<String, Object>> recentMedia = loadRecentMediaSafe(saved);
        return enrichCreatorSummary(saved, reels, recentMedia, includeAllBrands, callerEmail);
    }

    public Map<String, Object> syncCreatorFromInstagram(UUID creatorId) {
        return syncCreatorFromInstagram(creatorId, true, null, "Workspace Manager");
    }

    public Map<String, Object> syncCreatorFromInstagram(
            UUID creatorId,
            boolean includeAllBrands,
            String callerEmail,
            String actor) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        instagramGraphService.evictCreatorCache(creator.getHandle());
        boolean profileUpdated = !creator.isDemoData() && instagramGraphService.applyProfileIfAvailable(creator);
        List<ReelDeliverable> reels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
        int verifiedCount = 0;
        for (ReelDeliverable r : reels) {
            if (r.isDemoData() || creator.isDemoData()) {
                if ("VERIFIED".equals(r.getStatus())) verifiedCount++;
                continue;
            }
            ensureBaselineSnapshotBeforeSync(r);
            instagramGraphService.evictMediaCache(r.getIgMediaId());
            instagramGraphService.syncReelDeliverable(r, creator);
            if ("VERIFIED".equals(r.getStatus())) verifiedCount++;
        }
        List<ReelDeliverable> savedReels = reelRepository.saveAll(reels);
        List<ReelDeliverable> finalReels = (savedReels != null && !savedReels.isEmpty()) ? savedReels : reels;
        for (ReelDeliverable r : finalReels) {
            if (!r.isDemoData()) {
                recordDeliverableSnapshotIfChanged(r, true);
            }
        }
        Creator updated = rollUpCreatorMetrics(creator, finalReels);

        recordAudit(creator.getBrandId(), creator.getAgencyId(), "REEL_AUDIT", "Creator Stats Refreshed",
                verifiedCount > 0 || profileUpdated ? "Synced" : "Updated",
                "Refreshed " + creator.getHandle() + " (" + verifiedCount + " of " + reels.size() + " reels updated).",
                actor != null && !actor.isBlank() ? actor : "Workspace Manager", "Creator Sync");

        List<Map<String, Object>> recentMedia = creator.isDemoData() ? List.of() : loadRecentMediaSafe(updated);
        Map<String, Object> out = enrichCreatorSummary(updated, reels, recentMedia, includeAllBrands, callerEmail);
        out.put("profileUpdated", profileUpdated);
        out.put("verifiedDeliverables", verifiedCount);
        out.put("metaConfigured", instagramGraphService.isBusinessDiscoveryConfigured() || creator.isIgConnected());
        return out;
    }

    @Transactional
    public ReelDeliverable updateDeliverable(UUID deliverableId, Map<String, Object> payload) {
        return updateDeliverable(deliverableId, payload, "Workspace Manager");
    }

    @Transactional
    public ReelDeliverable updateDeliverable(UUID deliverableId, Map<String, Object> payload, String actor) {
        ReelDeliverable reel = reelRepository.findById(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("Deliverable not found."));
        if (payload != null) {
            if (payload.containsKey("title")) {
                String title = trimToMax(strVal(payload.get("title")), 160);
                if (!title.isEmpty()) reel.setTitle(title);
            }
            if (payload.containsKey("costQuoted")) {
                reel.setCostQuoted(parseNullablePositiveDouble(payload.get("costQuoted")));
            }
            if (payload.containsKey("campaignId") || payload.containsKey("campaignTag")) {
                String reqCid = payload.containsKey("campaignId") ? strVal(payload.get("campaignId")) : "";
                String reqTag = payload.containsKey("campaignTag") ? strVal(payload.get("campaignTag")) : "";
                if (reqCid.isEmpty() && reqTag.isEmpty()) {
                    reel.setCampaignId(null);
                    reel.setCampaignTag("");
                } else {
                    Campaign resolvedCamp = resolveCampaignForDeliverable(
                            reel.getBrandId(), reqCid, reqTag, "", actor, false);
                    if (resolvedCamp != null) {
                        reel.setCampaignId(resolvedCamp.getId());
                        reel.setCampaignTag(resolvedCamp.getName());
                        if (reel.getCreatorId() != null) {
                            ensureCampaignCreatorLinked(resolvedCamp.getId(), reel.getBrandId(), reel.getCreatorId(), reel.isDemoData(), 1, null);
                        }
                    } else {
                        reel.setCampaignId(null);
                        reel.setCampaignTag(trimToMax(reqTag, 80));
                    }
                }
            }
            applyManualHookRateFromPayload(reel, payload);
        }
        ReelDeliverable saved = reelRepository.save(reel);
        recordDeliverableSnapshotIfChanged(saved, false);
        Optional<Creator> parentCreator = creatorRepository.findById(saved.getCreatorId());
        parentCreator.ifPresent(this::rollUpCreatorMetrics);
        recordAudit(saved.getBrandId(), parentCreator.map(Creator::getAgencyId).orElse(null), "REEL_AUDIT", "Deliverable Updated", "Updated",
                "Updated deliverable (" + saved.getTitle() + ") metadata/pricing.",
                actor != null && !actor.isBlank() ? actor : "Workspace Manager", "Deliverables");
        return saved;
    }

    public ReelDeliverable syncDeliverableFromInstagram(UUID deliverableId) {
        ReelDeliverable reel = reelRepository.findById(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("Deliverable not found."));
        if (reel.isDemoData()) {
            return reel;
        }
        Creator creator = creatorRepository.findById(reel.getCreatorId())
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        if (creator.isDemoData()) {
            return reel;
        }
        ensureBaselineSnapshotBeforeSync(reel);
        instagramGraphService.evictCreatorCache(creator.getHandle());
        instagramGraphService.evictMediaCache(reel.getIgMediaId());
        instagramGraphService.syncReelDeliverable(reel, creator);
        ReelDeliverable saved = reelRepository.save(reel);
        recordDeliverableSnapshotIfChanged(saved, true);
        rollUpCreatorMetrics(creator);
        return saved;
    }

    @Transactional
    public void deleteCreator(UUID creatorId) {
        deleteCreator(creatorId, "Workspace Manager");
    }

    @Transactional
    public void deleteCreator(UUID creatorId, String actor) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        UUID agencyId = creator.getAgencyId();
        if (campaignCreatorRepository != null) {
            campaignCreatorRepository.deleteByCreatorId(creatorId);
        }
        if (reelSnapshotRepository != null) {
            reelSnapshotRepository.deleteByCreatorId(creatorId);
        }
        List<ReelDeliverable> reels = reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId);
        if (!reels.isEmpty()) {
            reelRepository.deleteAll(reels);
        }
        creatorRepository.delete(creator);
        if (agencyId != null) {
            agencyRepository.findById(agencyId).ifPresent(ag -> {
                ag.setCreatorsCount(creatorRepository.findByAgencyId(agencyId).size());
                agencyRepository.save(ag);
            });
        }
        recordAudit(creator.getBrandId(), agencyId, "CREATOR_LINK", "Creator Removed", "Removed",
                "Removed " + creator.getName() + " (" + creator.getHandle() + ") and associated deliverables.",
                actor != null && !actor.isBlank() ? actor : "Workspace Manager", "Roster Management");
    }

    @Transactional
    public void deleteDeliverable(UUID deliverableId) {
        ReelDeliverable reel = reelRepository.findById(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("Deliverable not found."));
        UUID creatorId = reel.getCreatorId();
        if (reelSnapshotRepository != null) {
            reelSnapshotRepository.deleteByDeliverableId(deliverableId);
        }
        reelRepository.delete(reel);
        creatorRepository.findById(creatorId).ifPresent(this::rollUpCreatorMetrics);
    }

    @Transactional
    public Creator attachCreatorOAuthProfile(UUID creatorId, Map<String, Object> oauthProfile) {
        Creator creator = creatorRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("Creator not found."));
        String incomingIgUserId = oauthProfile.get("igUserId") != null ? String.valueOf(oauthProfile.get("igUserId")).trim() : "";
        String incomingUsername = oauthProfile.get("username") != null ? InstagramGraphService.stripAt(String.valueOf(oauthProfile.get("username"))) : "";
        String expectedUsername = InstagramGraphService.stripAt(creator.getHandle());

        if (creator.getIgUserId() != null && !creator.getIgUserId().isBlank()
                && !incomingIgUserId.isEmpty() && !creator.getIgUserId().equals(incomingIgUserId)) {
            throw new IllegalArgumentException("Connected Instagram user ID does not match this creator profile.");
        }
        if (!expectedUsername.isEmpty() && !incomingUsername.isEmpty()
                && !expectedUsername.equalsIgnoreCase(incomingUsername)) {
            throw new IllegalArgumentException("Connected Instagram account (@" + incomingUsername + ") does not match creator " + creator.getHandle() + ".");
        }

        creator.setIgConnected(true);
        creator.setIgAccessToken((String) oauthProfile.get("accessToken"));
        creator.setIgTokenExpiresAt((Instant) oauthProfile.get("expiresAt"));
        if (!incomingIgUserId.isEmpty()) creator.setIgUserId(incomingIgUserId);
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

        recordAudit(creator.getBrandId(), creator.getAgencyId(), "CREATOR_LINK", "Creator Account Connected", "Connected",
                creator.getHandle() + " connected their creator profile.",
                creator.getName(), "Creator Account");
        return saved;
    }

    public Map<String, Object> syncBrandDeliverables(UUID brandId) {
        return syncBrandDeliverables(brandId, "Workspace Manager", null);
    }

    public Map<String, Object> syncBrandDeliverables(UUID brandId, String actor) {
        return syncBrandDeliverables(brandId, actor, null);
    }

    public Map<String, Object> syncBrandDeliverables(UUID brandId, String actor, Authentication auth) {
        return executeBrandDeliverableSync(brandId, actor, auth, false, false);
    }

    public Map<String, Object> syncBrandDeliverablesOnLogin(UUID brandId, String actor, Authentication auth) {
        return executeBrandDeliverableSync(brandId, actor, auth, true, true);
    }

    @org.springframework.scheduling.annotation.Scheduled(
            fixedDelayString = "${app.instagram.auto-sync.interval-ms:21600000}",
            initialDelayString = "${app.instagram.auto-sync.initial-delay-ms:120000}")
    public int runScheduledInstagramSync() {
        if (!autoSyncEnabled || !scheduledSyncRunning.compareAndSet(false, true)) {
            return 0;
        }
        int syncedBrands = 0;
        try {
            List<Brand> brands = brandRepository.findAllByOrderByCreatedAtDesc();
            for (Brand brand : brands) {
                if (brand == null || brand.getId() == null || "DRAFT".equalsIgnoreCase(brand.getStatus())) {
                    continue;
                }
                List<Creator> creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brand.getId());
                if (creators.isEmpty()) {
                    continue;
                }
                boolean hasMetaSource = instagramGraphService.isBusinessDiscoveryConfigured()
                        || creators.stream().anyMatch(Creator::isIgConnected);
                if (!hasMetaSource) {
                    continue;
                }
                try {
                    Map<String, Object> res = executeBrandDeliverableSync(
                            brand.getId(),
                            "Scheduled Auto-Sync",
                            null,
                            true,
                            true
                    );
                    if (!"RECENTLY_SYNCED".equals(res.get("status"))) {
                        syncedBrands++;
                    }
                } catch (IllegalStateException rateEx) {
                    if (rateEx.getMessage() != null
                            && rateEx.getMessage().toLowerCase(Locale.ROOT).contains("rate limit")) {
                        break;
                    }
                } catch (Exception ignored) {
                    // Isolate single-brand sync failure so remaining workspaces still sync
                }
            }
        } finally {
            scheduledSyncRunning.set(false);
        }
        return syncedBrands;
    }

    private Map<String, Object> executeBrandDeliverableSync(
            UUID brandId,
            String actor,
            Authentication auth,
            boolean includeAllForBrandOwner,
            boolean applyAutoCooldown) {
        Brand brand = getBrand(brandId);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        String scopeKey = brandId + ":" + scopedAgency.map(a -> a.getId().toString())
                .orElse(includeAllForBrandOwner || auth == null ? "ALL" : "DIRECT");

        if (applyAutoCooldown) {
            Instant lastSync = recentSyncTimestamps.get(scopeKey);
            Instant allSync = recentSyncTimestamps.get(brandId + ":ALL");
            Instant latest = (lastSync != null && allSync != null)
                    ? (lastSync.isAfter(allSync) ? lastSync : allSync)
                    : (lastSync != null ? lastSync : allSync);
            if (latest != null && latest.isAfter(Instant.now().minusSeconds(AUTO_SYNC_COOLDOWN_SECONDS))) {
                Map<String, Object> skipped = new LinkedHashMap<>();
                skipped.put("syncedCount", 0);
                skipped.put("verifiedCount", 0);
                skipped.put("pendingCount", 0);
                skipped.put("metaConfigured", instagramGraphService.isBusinessDiscoveryConfigured());
                skipped.put("status", "RECENTLY_SYNCED");
                skipped.put("syncedAt", latest.toString());
                return skipped;
            }
        }

        List<Creator> creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId).stream()
                .filter(c -> scopedAgency.isPresent()
                        ? creatorBelongsToAgency(c, scopedAgency.get())
                        : (auth == null || includeAllForBrandOwner || !isAgencyManagedCreator(c)))
                .toList();
        Map<UUID, Creator> creatorMap = new LinkedHashMap<>();
        for (Creator c : creators) {
            if (!c.isDemoData()) {
                instagramGraphService.evictCreatorCache(c.getHandle());
                instagramGraphService.applyProfileIfAvailable(c);
            }
            creatorMap.put(c.getId(), c);
        }

        List<ReelDeliverable> reels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId).stream()
                .filter(r -> (scopedAgency.isEmpty() && (auth == null || includeAllForBrandOwner))
                        || (r.getCreatorId() != null && creatorMap.containsKey(r.getCreatorId())))
                .toList();
        Map<UUID, List<ReelDeliverable>> reelsByCreator = new LinkedHashMap<>();
        int verifiedCount = 0;
        int pendingCount = 0;
        for (ReelDeliverable r : reels) {
            Creator c = creatorMap.get(r.getCreatorId());
            if (!r.isDemoData() && (c == null || !c.isDemoData())) {
                ensureBaselineSnapshotBeforeSync(r);
                instagramGraphService.evictMediaCache(r.getIgMediaId());
                instagramGraphService.syncReelDeliverable(r, c);
            }
            if ("VERIFIED".equals(r.getStatus())) {
                verifiedCount++;
            } else {
                pendingCount++;
            }
            reelsByCreator.computeIfAbsent(r.getCreatorId(), k -> new ArrayList<>()).add(r);
        }
        List<ReelDeliverable> savedReels = reelRepository.saveAll(reels);
        List<ReelDeliverable> snapReels = (savedReels != null && !savedReels.isEmpty()) ? savedReels : reels;
        for (ReelDeliverable r : snapReels) {
            if (!r.isDemoData()) {
                recordDeliverableSnapshotIfChanged(r, true);
            }
        }
        for (Creator c : creators) {
            rollUpCreatorMetrics(c, reelsByCreator.getOrDefault(c.getId(), List.of()));
        }

        Instant now = Instant.now();
        recentSyncTimestamps.put(scopeKey, now);
        brand.setUpdatedAt(now);
        brandRepository.save(brand);

        boolean configured = instagramGraphService.isBusinessDiscoveryConfigured()
                || creators.stream().anyMatch(Creator::isIgConnected);

        if (!applyAutoCooldown || !reels.isEmpty() || !creators.isEmpty()) {
            recordAudit(brandId, scopedAgency.map(Agency::getId).orElse(null), "REEL_AUDIT", "Reels Refreshed",
                    "Refreshed",
                    "Updated " + verifiedCount + " verified reel(s) across " + creators.size() + " creator(s).",
                    actor != null && !actor.isBlank() ? actor : "Workspace Manager", "Reels");
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("syncedCount", reels.size());
        out.put("verifiedCount", verifiedCount);
        out.put("pendingCount", pendingCount);
        out.put("metaConfigured", configured);
        out.put("status", configured ? "SYNCED" : "PENDING_META_CREDENTIALS");
        out.put("syncedAt", now.toString());
        return out;
    }

    private static boolean isStaticPhotoType(String mediaType) {
        if (mediaType == null || mediaType.isBlank()) return false;
        String upper = mediaType.toUpperCase(Locale.ROOT);
        return "IMAGE".equals(upper) || "CAROUSEL_ALBUM".equals(upper) || "FEED".equals(upper);
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
        long totalReach = safeItems.stream()
                .mapToLong(r -> r.getReachCount() > 0 ? r.getReachCount() : r.getViewsCount())
                .sum();
        long totalInteractions = safeItems.stream()
                .mapToLong(r -> r.getLikesCount() + r.getCommentsCount())
                .sum();
        double trackedIrPct = (creator.getFollowersCount() > 0 && totalInteractions > 0)
                ? Math.round((totalInteractions * 100.0 / creator.getFollowersCount()) * 100.0) / 100.0
                : 0.0;

        creator.setAuditedReelsCount(safeItems.size());

        boolean hasAuthoritativeAccountInsights = "CREATOR_OAUTH_INSIGHTS".equals(creator.getInsightsSource())
                || "META_CREATOR_MARKETPLACE".equals(creator.getInsightsSource());
        if (hasAuthoritativeAccountInsights) {
            if (totalReach > creator.getReachCount()) {
                creator.setReachCount(totalReach);
            }
            if (totalViews > creator.getTotalViews30d()) {
                creator.setTotalViews30d(totalViews);
            }
            if (totalInteractions > creator.getAccountInteractions30d()) {
                creator.setAccountInteractions30d(totalInteractions);
            }
            if (creator.getInteractionRate90d() == 0 && trackedIrPct > 0) {
                creator.setInteractionRate90d(trackedIrPct);
            }
            if (creator.getEngagementRate() == 0 && creator.getInteractionRate90d() > 0) {
                creator.setEngagementRate(creator.getInteractionRate90d());
            }
        } else if (!safeItems.isEmpty()) {
            creator.setReachCount(totalReach);
            creator.setTotalViews30d(totalViews);
            creator.setAccountInteractions30d(totalInteractions);
            creator.setInteractionRate90d(trackedIrPct);
            creator.setEngagementRate(trackedIrPct);
        }

        InstagramGraphService.HookRateRollup hookRollup = InstagramGraphService.computeViewWeightedHookRate(safeItems);
        if (hookRollup.avgHookRatePct() != null) {
            creator.setHookRate90d(hookRollup.avgHookRatePct());
        }

        instagramGraphService.evaluateCreatorQualification(creator);
        creator.setLastSyncedAt(Instant.now());
        return creatorRepository.save(creator);
    }

    public Map<String, Object> listAuditLogs(UUID brandId, String category, String search, int page, int size) {
        return listAuditLogs(brandId, category, search, page, size, null);
    }

    public Map<String, Object> listAuditLogs(UUID brandId, String category, String search, int page, int size, Authentication auth) {
        Optional<Agency> scopedAgency = (auth != null)
                ? resolveScopedAgencyForCaller(getBrand(brandId), auth)
                : Optional.empty();
        Set<String> agencyCreatorHandles = new HashSet<>();
        if (scopedAgency.isPresent()) {
            Agency ag = scopedAgency.get();
            for (Creator c : creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId)) {
                if (creatorBelongsToAgency(c, ag) && c.getHandle() != null && !c.getHandle().isBlank()) {
                    agencyCreatorHandles.add(c.getHandle().toLowerCase(Locale.ROOT));
                }
            }
        }
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        List<AuditLog> filtered = auditLogRepository.findByBrandIdOrderByCreatedAtDesc(brandId).stream()
                .filter(l -> {
                    if (scopedAgency.isEmpty()) return true;
                    Agency ag = scopedAgency.get();
                    // Never expose brand-level SYSTEM events to a Partner Agency Manager
                    if ("SYSTEM".equalsIgnoreCase(l.getCategory())) {
                        return false;
                    }
                    if (l.getAgencyId() != null) {
                        return l.getAgencyId().equals(ag.getId());
                    }
                    String actor = l.getActor() != null ? l.getActor().trim().toLowerCase(Locale.ROOT) : "";
                    String desc = l.getDescription() != null ? l.getDescription().toLowerCase(Locale.ROOT) : "";
                    String agEmail = ag.getContactEmail() != null ? ag.getContactEmail().trim().toLowerCase(Locale.ROOT) : "";
                    if ("AGENCY_PERMISSION".equalsIgnoreCase(l.getCategory())) {
                        if (!agEmail.isEmpty() && desc.contains("(" + agEmail + ")")) {
                            return true;
                        }
                        return ag.getName() != null && !ag.getName().isBlank()
                                && desc.startsWith(ag.getName().trim().toLowerCase(Locale.ROOT) + " ");
                    }
                    if (!agEmail.isEmpty() && actor.equals(agEmail)) {
                        return true;
                    }
                    for (String h : agencyCreatorHandles) {
                        if (desc.contains(h)) return true;
                    }
                    return false;
                })
                .filter(l -> category == null || category.isBlank() || category.equalsIgnoreCase("ALL")
                        || (l.getCategory() != null && l.getCategory().equalsIgnoreCase(category)))
                .filter(l -> {
                    if (search == null || search.isBlank()) return true;
                    String q = search.toLowerCase(Locale.ROOT);
                    return (l.getEventCode() != null && l.getEventCode().toLowerCase(Locale.ROOT).contains(q))
                            || (l.getTitle() != null && l.getTitle().toLowerCase(Locale.ROOT).contains(q))
                            || (l.getDescription() != null && l.getDescription().toLowerCase(Locale.ROOT).contains(q))
                            || (l.getActor() != null && l.getActor().toLowerCase(Locale.ROOT).contains(q));
                })
                .toList();

        int total = filtered.size();
        long fromLong = Math.min((long) safePage * safeSize, total);
        int from = (int) fromLong;
        int to = (int) Math.min(fromLong + safeSize, total);

        return Map.of(
                "items", filtered.subList(from, to),
                "total", total,
                "page", safePage,
                "size", safeSize
        );
    }

    public String exportBrandCsv(UUID brandId) {
        return exportBrandCsv(brandId, null, null);
    }

    public String exportBrandCsv(UUID brandId, Authentication auth) {
        return exportBrandCsv(brandId, auth, null);
    }

    public String exportBrandCsv(UUID brandId, Authentication auth, String campaignFilter) {
        Brand brand = getBrand(brandId);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        String activeCampaign = (campaignFilter != null && !campaignFilter.isBlank() && !"ALL".equalsIgnoreCase(campaignFilter.trim()))
                ? campaignFilter.trim()
                : null;
        List<ReelDeliverable> allReels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId);
        Map<UUID, List<ReelDeliverable>> deliverablesByCreator = new HashMap<>();
        for (ReelDeliverable r : allReels) {
            deliverablesByCreator.computeIfAbsent(r.getCreatorId(), k -> new ArrayList<>()).add(r);
        }
        List<Creator> creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId).stream()
                .filter(c -> scopedAgency.isEmpty() || creatorBelongsToAgency(c, scopedAgency.get()))
                .filter(c -> activeCampaign == null || creatorMatchesCampaign(c, deliverablesByCreator.getOrDefault(c.getId(), List.of()), activeCampaign))
                .toList();
        StringBuilder sb = new StringBuilder();
        sb.append("Brand,Code,Creator,Handle,Tier,Category,ManagementHandle,Country,Followers,AccountInteractions,Views,InteractionRate,CostMode,CostQuoted,Verified,PreviousPartners,Source,Agency,Campaign,AuditedReels,EngagementRate,HookRate,Status\n");
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
              .append(c.getHookRate90d() > 0 ? c.getHookRate90d() + "%" : "").append(',')
              .append(csv(c.getStatus())).append('\n');
        }
        return sb.toString();
    }

    public Double parseNullablePositiveDouble(Object v) {
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

    public String strVal(Object v) {
        return v != null ? String.valueOf(v).trim() : "";
    }

    private String strListOrString(Object v) {
        if (v instanceof Collection<?> col) {
            return col.stream().map(this::strVal).filter(s -> !s.isEmpty()).reduce((a, b) -> a + ", " + b).orElse("");
        }
        return strVal(v);
    }

    public void recordAudit(UUID brandId, String category, String title, String badge,
                             String description, String actor, String tag) {
        recordAudit(brandId, null, category, title, badge, description, actor, tag);
    }

    public void recordAudit(UUID brandId, UUID agencyId, String category, String title, String badge,
                             String description, String actor, String tag) {
        AuditLog log = new AuditLog();
        log.setBrandId(brandId);
        log.setAgencyId(agencyId);
        log.setCategory(category);
        log.setTitle(title);
        log.setStatusBadge(badge);
        log.setDescription(description);
        log.setActor(actor);
        log.setMetadataTag(tag);
        String prefix = category != null && category.length() >= 2 ? category.substring(0, 2) : "SY";
        log.setEventCode("EVT-" + (1000 + ThreadLocalRandom.current().nextInt(8999)) + "-" + prefix);
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

    private String normalizeReelUrl(String rawUrl) {
        if (rawUrl == null) return "";
        String trimmed = rawUrl.trim();
        int q = trimmed.indexOf('?');
        if (q >= 0) trimmed = trimmed.substring(0, q);
        int hash = trimmed.indexOf('#');
        if (hash >= 0) trimmed = trimmed.substring(0, hash);
        return trimmed.replaceAll("/+$", "");
    }

    private String csv(String v) {
        if (v == null) return "";
        String sanitized = v.replace("\u0000", "");
        String leadingTrimmed = sanitized.stripLeading();
        boolean dangerousStart = !sanitized.isEmpty() && (
                sanitized.charAt(0) == '\t' || sanitized.charAt(0) == '\r' || sanitized.charAt(0) == '\n'
                || (!leadingTrimmed.isEmpty() && "=+-@\t\r".indexOf(leadingTrimmed.charAt(0)) >= 0)
        );
        if (dangerousStart) {
            sanitized = "'" + sanitized;
        }
        return "\"" + sanitized.replace("\"", "\"\"") + "\"";
    }

    private boolean hasSnapshotableData(ReelDeliverable reel) {
        return reel != null && reel.getId() != null && (
                reel.getViewsCount() > 0
                || reel.getLikesCount() > 0
                || reel.getCommentsCount() > 0
                || reel.getSavesCount() > 0
                || reel.getSharesCount() > 0
                || "VERIFIED".equals(reel.getStatus())
        );
    }

    private void ensureBaselineSnapshotBeforeSync(ReelDeliverable preSyncReel) {
        if (reelSnapshotRepository == null || !hasSnapshotableData(preSyncReel)) {
            return;
        }
        if (reelSnapshotRepository.findFirstByDeliverableIdOrderByCapturedAtDesc(preSyncReel.getId()).isPresent()) {
            return;
        }
        saveSnapshotPoint(
                preSyncReel,
                preSyncReel.getSyncedAt() != null ? preSyncReel.getSyncedAt() : Instant.now().minusSeconds(60)
        );
    }

    private void recordDeliverableSnapshotIfChanged(ReelDeliverable reel, boolean allowPeriodicCheckIn) {
        if (reelSnapshotRepository == null || !hasSnapshotableData(reel)) {
            return;
        }
        Optional<ReelSnapshot> latestOpt = reelSnapshotRepository.findFirstByDeliverableIdOrderByCapturedAtDesc(reel.getId());
        if (latestOpt.isEmpty()) {
            saveSnapshotPoint(reel, reel.getSyncedAt() != null ? reel.getSyncedAt() : Instant.now());
            return;
        }
        ReelSnapshot latest = latestOpt.get();
        boolean metricsChanged = latest.getViewsCount() != reel.getViewsCount()
                || latest.getLikesCount() != reel.getLikesCount()
                || latest.getCommentsCount() != reel.getCommentsCount()
                || latest.getSavesCount() != reel.getSavesCount()
                || latest.getSharesCount() != reel.getSharesCount()
                || !Objects.equals(latest.getHookRatePct(), reel.getHookRatePct());
        boolean intervalElapsed = allowPeriodicCheckIn
                && latest.getCapturedAt() != null
                && latest.getCapturedAt().isBefore(Instant.now().minusSeconds(6 * 3600L));
        if (metricsChanged || intervalElapsed) {
            saveSnapshotPoint(reel, Instant.now());
        }
    }

    private void saveSnapshotPoint(ReelDeliverable reel, Instant capturedAt) {
        ReelSnapshot snap = new ReelSnapshot();
        snap.setDeliverableId(reel.getId());
        snap.setBrandId(reel.getBrandId());
        snap.setCreatorId(reel.getCreatorId());
        snap.setViewsCount(reel.getViewsCount());
        snap.setLikesCount(reel.getLikesCount());
        snap.setCommentsCount(reel.getCommentsCount());
        snap.setSavesCount(reel.getSavesCount());
        snap.setSharesCount(reel.getSharesCount());
        snap.setHookRatePct(reel.getHookRatePct());
        snap.setCapturedAt(capturedAt != null ? capturedAt : Instant.now());
        reelSnapshotRepository.save(snap);
    }

    @SuppressWarnings("unchecked")
    private void attachSnapshotHistory(Map<String, Object> summary, ReelDeliverable reel) {
        if (summary == null || reel == null) return;
        List<ReelSnapshot> desc = (reelSnapshotRepository != null && reel.getId() != null)
                ? reelSnapshotRepository.findTop14ByDeliverableIdOrderByCapturedAtDesc(reel.getId())
                : List.of();
        Map<String, Object> bundle = buildSnapshotBundleForReel(reel, desc);
        summary.put("snapshots", bundle.get("snapshots"));
        Object derivedObj = summary.get("derived");
        if (derivedObj instanceof Map<?, ?>) {
            Map<String, Object> derived = (Map<String, Object>) derivedObj;
            derived.put("viewsDeltaLastSync", bundle.get("viewsDeltaLastSync"));
            derived.put("likesDeltaLastSync", bundle.get("likesDeltaLastSync"));
            derived.put("commentsDeltaLastSync", bundle.get("commentsDeltaLastSync"));
            derived.put("snapshotCount", bundle.get("snapshotCount"));
        }
    }

    public Map<String, Map<String, Object>> buildBrandReelDeltasMap(UUID brandId, List<ReelDeliverable> scopedReels) {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        if (scopedReels == null || scopedReels.isEmpty()) {
            return out;
        }
        Map<UUID, List<ReelSnapshot>> byDeliverable = new HashMap<>();
        if (reelSnapshotRepository != null) {
            for (ReelSnapshot s : reelSnapshotRepository.findByBrandIdOrderByCapturedAtDesc(brandId)) {
                List<ReelSnapshot> list = byDeliverable.computeIfAbsent(s.getDeliverableId(), k -> new ArrayList<>());
                if (list.size() < 7) {
                    list.add(s);
                }
            }
        }
        for (ReelDeliverable r : scopedReels) {
            if (r.getId() == null) continue;
            List<ReelSnapshot> desc = byDeliverable.getOrDefault(r.getId(), List.of());
            out.put(r.getId().toString(), buildSnapshotBundleForReel(r, desc));
        }
        return out;
    }

    private Map<String, Object> buildSnapshotBundleForReel(ReelDeliverable reel, List<ReelSnapshot> desc) {
        List<ReelSnapshot> asc = new ArrayList<>(desc);
        Collections.reverse(asc);
        List<Map<String, Object>> points = new ArrayList<>();
        for (int i = 0; i < asc.size(); i++) {
            ReelSnapshot cur = asc.get(i);
            long prevViews = i > 0 ? asc.get(i - 1).getViewsCount() : cur.getViewsCount();
            long prevLikes = i > 0 ? asc.get(i - 1).getLikesCount() : cur.getLikesCount();
            Map<String, Object> pt = new LinkedHashMap<>();
            pt.put("viewsCount", cur.getViewsCount());
            pt.put("likesCount", cur.getLikesCount());
            pt.put("commentsCount", cur.getCommentsCount());
            pt.put("savesCount", cur.getSavesCount());
            pt.put("hookRatePct", cur.getHookRatePct());
            pt.put("deltaViews", i > 0 ? (cur.getViewsCount() - prevViews) : 0L);
            pt.put("deltaLikes", i > 0 ? (cur.getLikesCount() - prevLikes) : 0L);
            pt.put("capturedAt", cur.getCapturedAt());
            points.add(pt);
        }
        if (points.isEmpty() && hasSnapshotableData(reel)) {
            Map<String, Object> baseline = new LinkedHashMap<>();
            baseline.put("viewsCount", reel.getViewsCount());
            baseline.put("likesCount", reel.getLikesCount());
            baseline.put("commentsCount", reel.getCommentsCount());
            baseline.put("savesCount", reel.getSavesCount());
            baseline.put("hookRatePct", reel.getHookRatePct());
            baseline.put("deltaViews", 0L);
            baseline.put("deltaLikes", 0L);
            baseline.put("capturedAt", reel.getSyncedAt() != null ? reel.getSyncedAt() : Instant.now());
            points.add(baseline);
        }

        long viewsDeltaLastSync = 0L;
        long likesDeltaLastSync = 0L;
        long commentsDeltaLastSync = 0L;
        if (asc.size() >= 2) {
            ReelSnapshot latest = asc.get(asc.size() - 1);
            ReelSnapshot prev = asc.get(asc.size() - 2);
            viewsDeltaLastSync = latest.getViewsCount() - prev.getViewsCount();
            likesDeltaLastSync = latest.getLikesCount() - prev.getLikesCount();
            commentsDeltaLastSync = latest.getCommentsCount() - prev.getCommentsCount();
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("snapshotCount", asc.size());
        result.put("viewsDeltaLastSync", viewsDeltaLastSync);
        result.put("likesDeltaLastSync", likesDeltaLastSync);
        result.put("commentsDeltaLastSync", commentsDeltaLastSync);
        result.put("snapshots", points);
        return result;
    }

    @Transactional
    public Brand updateBrandWorkspaceSettings(UUID brandId, Map<String, Object> payload, String actor) {
        Brand brand = getBrand(brandId);
        if (payload == null) {
            throw new IllegalArgumentException("Settings payload is required.");
        }
        if (payload.containsKey("targetViewsGoal")) {
            Object raw = payload.get("targetViewsGoal");
            if (raw == null || String.valueOf(raw).isBlank()) {
                brand.setTargetViewsGoal(null);
            } else {
                long parsed;
                try {
                    String cleaned = String.valueOf(raw).replaceAll("[,\\s]", "").trim();
                    parsed = Long.parseLong(cleaned);
                } catch (NumberFormatException ex) {
                    throw new IllegalArgumentException("Target views goal must be a valid whole number.");
                }
                if (parsed < 0) {
                    throw new IllegalArgumentException("Target views goal cannot be negative.");
                }
                brand.setTargetViewsGoal(parsed == 0L ? null : parsed);
            }
        }
        brand.setUpdatedAt(Instant.now());
        Brand saved = brandRepository.save(brand);
        recordAudit(brandId, "SYSTEM", "Campaign Goal Updated", "Updated",
                saved.getTargetViewsGoal() != null
                        ? "Updated target views goal to " + InstagramGraphService.formatCompactNumber(saved.getTargetViewsGoal()) + "."
                        : "Cleared target views goal.",
                actor != null && !actor.isBlank() ? actor : "Brand Manager", "Campaign Goal");
        return saved;
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> bulkImportDeliverables(UUID brandId, Map<String, Object> payload, Authentication auth) {
        Brand brand = requireBrandAccess(brandId, auth);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        String actor = resolveActor(auth, scopedAgency.isPresent() ? "Agency Manager" : "Brand Manager");

        if (payload == null || !(payload.get("items") instanceof List<?> rawItems) || rawItems.isEmpty()) {
            throw new IllegalArgumentException("Paste at least one Instagram Reel or Post URL to import.");
        }
        if (rawItems.size() > 50) {
            throw new IllegalArgumentException("Maximum 50 Instagram URLs can be imported in a single batch.");
        }

        Creator defaultCreator = null;
        String defaultCreatorIdStr = strVal(payload.get("defaultCreatorId"));
        if (!defaultCreatorIdStr.isEmpty()) {
            UUID defaultId;
            try {
                defaultId = UUID.fromString(defaultCreatorIdStr);
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Invalid default creator selection.");
            }
            defaultCreator = creatorRepository.findById(defaultId)
                    .orElseThrow(() -> new IllegalArgumentException("Selected creator not found."));
            if (!brandId.equals(defaultCreator.getBrandId()) || !canCallerManageCreator(defaultCreator, scopedAgency)) {
                throw new AccessDeniedException("You do not have permission to add deliverables to this creator.");
            }
        }

        String defaultCampaignIdStr = strVal(payload.get("defaultCampaignId"));
        Campaign defaultCampaign = !defaultCampaignIdStr.isEmpty()
                ? resolveCampaignByIdForBrand(brandId, defaultCampaignIdStr, scopedAgency.isPresent())
                : null;
        String defaultCampaignTag = defaultCampaign != null
                ? defaultCampaign.getName()
                : trimToMax(strVal(payload.get("defaultCampaignTag")), 80);
        Double defaultCost = parseNullablePositiveDouble(payload.get("defaultCostQuoted"));

        Map<String, Creator> creatorCache = new LinkedHashMap<>();
        for (Creator existing : creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId)) {
            if (existing.getHandle() != null && !existing.getHandle().isBlank()) {
                creatorCache.put(existing.getHandle().toLowerCase(Locale.ROOT), existing);
            }
        }
        Map<UUID, Set<String>> seenShortcodes = new HashMap<>();
        Map<UUID, Set<String>> seenUrls = new HashMap<>();

        List<ReelDeliverable> added = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();
        Set<UUID> touchedCreatorIds = new LinkedHashSet<>();
        int skippedDuplicates = 0;
        int createdCreatorsCount = 0;
        boolean rateLimitedHit = false;

        for (int i = 0; i < rawItems.size(); i++) {
            int rowNum = i + 1;
            Object rawEntry = rawItems.get(i);
            if (!(rawEntry instanceof Map<?, ?> entryMap)) {
                errors.add(Map.of("row", rowNum, "reelUrl", "", "reason", "Malformed row format."));
                continue;
            }

            String reelUrl = strVal(entryMap.get("reelUrl"));
            String shortcode = InstagramGraphService.extractShortcode(reelUrl);
            if (reelUrl.isEmpty() || shortcode == null) {
                errors.add(Map.of("row", rowNum, "reelUrl", reelUrl, "reason", "Invalid public Instagram Reel or Post URL."));
                continue;
            }

            String itemCampaignIdStr = strVal(entryMap.get("campaignId"));
            String itemCampaignTag = trimToMax(strVal(entryMap.get("campaignTag")), 80);
            Campaign itemCampaign = null;
            if (!itemCampaignIdStr.isEmpty()) {
                itemCampaign = resolveCampaignByIdForBrand(brandId, itemCampaignIdStr, scopedAgency.isPresent());
                itemCampaignTag = itemCampaign.getName();
            } else if (!itemCampaignTag.isEmpty() && campaignRepository != null) {
                itemCampaign = campaignRepository.findByBrandIdAndNameIgnoreCase(brandId, itemCampaignTag).orElse(null);
            } else if (itemCampaignTag.isEmpty()) {
                itemCampaign = defaultCampaign;
                itemCampaignTag = defaultCampaignTag;
            }

            Double itemCost = null;
            if (entryMap.get("costQuoted") != null && !strVal(entryMap.get("costQuoted")).isEmpty()) {
                try {
                    itemCost = parseNullablePositiveDouble(entryMap.get("costQuoted"));
                } catch (IllegalArgumentException badCost) {
                    errors.add(Map.of("row", rowNum, "reelUrl", reelUrl, "reason", badCost.getMessage()));
                    continue;
                }
            } else {
                itemCost = defaultCost;
            }

            Creator targetCreator = null;
            String rawHandle = strVal(entryMap.get("creatorHandle"));
            if (rawHandle.isEmpty()) {
                String extractedOwner = InstagramGraphService.extractUrlOwnerHandle(reelUrl);
                if (extractedOwner != null) rawHandle = extractedOwner;
            }

            if (!rawHandle.isEmpty()) {
                String normHandle = InstagramGraphService.normalizeHandle(rawHandle);
                if (normHandle.isEmpty() || !InstagramGraphService.isValidHandle(normHandle)) {
                    errors.add(Map.of("row", rowNum, "reelUrl", reelUrl, "reason", "Invalid creator handle: " + rawHandle));
                    continue;
                }
                Creator existingCreator = creatorCache.get(normHandle.toLowerCase(Locale.ROOT));
                if (existingCreator != null) {
                    if (!canCallerManageCreator(existingCreator, scopedAgency)) {
                        errors.add(Map.of("row", rowNum, "reelUrl", reelUrl, "reason", "Creator " + existingCreator.getHandle() + " is managed by a partner agency."));
                        continue;
                    }
                    targetCreator = existingCreator;
                } else {
                    targetCreator = createAutoCreatorForImport(brand, scopedAgency, normHandle, itemCampaignTag, rateLimitedHit);
                    creatorCache.put(normHandle.toLowerCase(Locale.ROOT), targetCreator);
                    createdCreatorsCount++;
                }
            } else if (defaultCreator != null) {
                targetCreator = defaultCreator;
            } else {
                errors.add(Map.of("row", rowNum, "reelUrl", reelUrl, "reason", "Creator @handle not found in URL; include @handle or pick a default creator."));
                continue;
            }

            Creator finalTarget = targetCreator;
            Set<String> scSet = seenShortcodes.computeIfAbsent(finalTarget.getId(), id -> {
                Set<String> set = new HashSet<>();
                for (ReelDeliverable r : reelRepository.findByCreatorIdOrderBySyncedAtDesc(id)) {
                    String sc = r.getShortcode() != null && !r.getShortcode().isBlank()
                            ? r.getShortcode()
                            : InstagramGraphService.extractShortcode(r.getReelUrl());
                    if (sc != null) set.add(sc.toLowerCase(Locale.ROOT));
                }
                return set;
            });
            Set<String> urlSet = seenUrls.computeIfAbsent(finalTarget.getId(), id -> {
                Set<String> set = new HashSet<>();
                for (ReelDeliverable r : reelRepository.findByCreatorIdOrderBySyncedAtDesc(id)) {
                    set.add(normalizeReelUrl(r.getReelUrl()).toLowerCase(Locale.ROOT));
                }
                return set;
            });

            String normUrl = normalizeReelUrl(reelUrl).toLowerCase(Locale.ROOT);
            if (scSet.contains(shortcode.toLowerCase(Locale.ROOT)) || urlSet.contains(normUrl)) {
                skippedDuplicates++;
                continue;
            }

            String title = trimToMax(strVal(entryMap.get("title")), 160);
            if (title.isEmpty()) title = "Campaign Reel Deliverable";
            if (itemCampaign == null && itemCampaignTag.isEmpty() && finalTarget.getCampaignName() != null && !finalTarget.getCampaignName().isBlank()) {
                itemCampaignTag = trimToMax(finalTarget.getCampaignName(), 80);
                if (campaignRepository != null) {
                    itemCampaign = campaignRepository.findByBrandIdAndNameIgnoreCase(brandId, itemCampaignTag).orElse(null);
                }
            }

            ReelDeliverable reel = new ReelDeliverable();
            reel.setBrandId(brandId);
            reel.setCreatorId(finalTarget.getId());
            reel.setCreatorHandle(finalTarget.getHandle());
            reel.setTitle(title);
            reel.setReelUrl(reelUrl);
            reel.setShortcode(shortcode);
            reel.setCampaignId(itemCampaign != null ? itemCampaign.getId() : null);
            reel.setCampaignTag(itemCampaign != null ? itemCampaign.getName() : itemCampaignTag);
            if (itemCost != null) {
                reel.setCostQuoted(itemCost);
            }

            if (!rateLimitedHit && !finalTarget.isDemoData()) {
                try {
                    instagramGraphService.syncReelDeliverable(reel, finalTarget);
                } catch (IllegalStateException rateEx) {
                    if (rateEx.getMessage() != null && rateEx.getMessage().toLowerCase(Locale.ROOT).contains("rate limit")) {
                        rateLimitedHit = true;
                    }
                    reel.setStatus("PENDING_META_SYNC");
                    reel.setMetricsSource("RATE_LIMIT_DEFERRED");
                }
            } else {
                reel.setStatus("PENDING_META_SYNC");
            }
            try {
                applyManualHookRateFromPayload(reel, entryMap);
            } catch (IllegalArgumentException badHook) {
                errors.add(Map.of("row", rowNum, "reelUrl", reelUrl, "reason", badHook.getMessage()));
                continue;
            }

            ReelDeliverable saved = reelRepository.save(reel);
            if (itemCampaign != null) {
                ensureCampaignCreatorLinked(itemCampaign.getId(), brandId, finalTarget.getId(), finalTarget.isDemoData(), 1, itemCost);
            }
            recordDeliverableSnapshotIfChanged(saved, false);
            scSet.add(shortcode.toLowerCase(Locale.ROOT));
            urlSet.add(normUrl);
            added.add(saved);
            touchedCreatorIds.add(finalTarget.getId());
        }

        for (UUID cid : touchedCreatorIds) {
            creatorRepository.findById(cid).ifPresent(this::rollUpCreatorMetrics);
        }
        if (scopedAgency.isPresent() && createdCreatorsCount > 0) {
            Agency ag = scopedAgency.get();
            ag.setCreatorsCount(creatorRepository.findByAgencyId(ag.getId()).size());
            agencyRepository.save(ag);
        }

        if (!added.isEmpty() || createdCreatorsCount > 0) {
            recordAudit(brandId, scopedAgency.map(Agency::getId).orElse(null), "REEL_AUDIT",
                    "Bulk Reels Imported", "Imported",
                    "Imported " + added.size() + " deliverable(s)"
                            + (createdCreatorsCount > 0 ? " across " + createdCreatorsCount + " new creator(s)" : "")
                            + (skippedDuplicates > 0 ? " (" + skippedDuplicates + " duplicate skipped)." : "."),
                    actor, "Bulk Import");
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("addedCount", added.size());
        out.put("skippedDuplicatesCount", skippedDuplicates);
        out.put("failedCount", errors.size());
        out.put("createdCreatorsCount", createdCreatorsCount);
        out.put("deliverables", added);
        out.put("errors", errors);
        return out;
    }

    private Creator createAutoCreatorForImport(
            Brand brand,
            Optional<Agency> scopedAgency,
            String normHandle,
            String campaignTag,
            boolean skipProfileSync) {
        Creator creator = new Creator();
        creator.setBrandId(brand.getId());
        creator.setName(InstagramGraphService.stripAt(normHandle));
        creator.setHandle(normHandle);
        creator.setProfileUrl("https://www.instagram.com/" + InstagramGraphService.stripAt(normHandle) + "/");
        if (scopedAgency.isPresent()) {
            Agency ag = scopedAgency.get();
            creator.setSourceType("AGENCY");
            creator.setAgencyId(ag.getId());
            creator.setAgencyName(ag.getName());
            creator.setNiche(ag.getName());
            creator.setCategory(ag.getName());
        } else {
            creator.setSourceType("DIRECT");
            creator.setAgencyName("Direct / Independent");
            creator.setNiche("Direct / Independent");
            creator.setCategory("Direct / Independent");
        }
        creator.setCampaignName(campaignTag);
        creator.setCostMode("COLLECTIVE");
        creator.setFollowersDisplay("—");
        creator.setStatus("ACTIVE_VERIFIED");
        if (!skipProfileSync) {
            try {
                instagramGraphService.applyProfileIfAvailable(creator);
            } catch (Exception ignored) {
                // Non-fatal during bulk import; creator profile can sync later
            }
        }
        instagramGraphService.evaluateCreatorQualification(creator);
        return creatorRepository.save(creator);
    }

    private boolean canCallerManageCreator(Creator creator, Optional<Agency> scopedAgency) {
        if (creator == null) return false;
        if (scopedAgency.isPresent()) {
            return creatorBelongsToAgency(creator, scopedAgency.get());
        }
        return !isAgencyManagedCreator(creator);
    }

    @Transactional
    public Map<String, Object> seedDemoCampaign(UUID brandId, Authentication auth) {
        Brand brand = requireBrandAccess(brandId, auth);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        String actor = resolveActor(auth, "Workspace Manager");

        List<Creator> existingDemo = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId).stream()
                .filter(Creator::isDemoData)
                .filter(c -> scopedAgency.isEmpty() || creatorBelongsToAgency(c, scopedAgency.get()))
                .toList();
        if (!existingDemo.isEmpty()) {
            return Map.of("alreadyLoaded", true, "creatorsAdded", 0, "reelsAdded", 0);
        }

        Instant now = Instant.now();
        Campaign summerCamp = ensureDemoCampaignRecord(brandId, "Summer Glow Drop", 225_000.0, 2_200_000L,
                "Hero summer product launch Reels showcasing daily Vitamin C & hydration routines.", -14, 16);
        Campaign monsoonCamp = ensureDemoCampaignRecord(brandId, "Monsoon Creator Wave", 120_000.0, 800_000L,
                "Monsoon travel-ready skincare & honest SPF review deliverables.", -7, 21);

        List<Creator> createdCreators = new ArrayList<>();
        Creator aanya = saveDemoCreator(brandId, scopedAgency, "Aanya Kapoor", "@aanya.kapoor_demo",
                "Skincare & Beauty", "India", 284_000L, "284K", "PER_DELIVERABLE", 35_000.0,
                "Summer Glow Drop", true);
        Creator rohan = saveDemoCreator(brandId, scopedAgency, "Rohan Mehta", "@rohan.mehta_demo",
                "Lifestyle & Grooming", "India", 412_000L, "412K", "PER_DELIVERABLE", 48_000.0,
                "Summer Glow Drop", true);
        Creator nisha = saveDemoCreator(brandId, scopedAgency, "Nisha Sharma", "@nisha.sharma_demo",
                "Fashion & Daily Routines", "India", 165_000L, "165K", "COLLECTIVE", 55_000.0,
                "Monsoon Creator Wave", false);
        Creator kabir = saveDemoCreator(brandId, scopedAgency, "Kabir Verma", "@kabir.verma_demo",
                "Fitness & Wellness", "India", 520_000L, "520K", "COLLECTIVE", 90_000.0,
                "Summer Glow Drop", true);
        Creator tara = saveDemoCreator(brandId, scopedAgency, "Tara Patel", "@tara.patel_demo",
                "Clean Beauty Reviews", "India", 98_000L, "98K", "PER_DELIVERABLE", 18_000.0,
                "Monsoon Creator Wave", false);
        createdCreators.addAll(List.of(aanya, rohan, nisha, kabir, tara));

        if (summerCamp != null) {
            ensureCampaignCreatorLinked(summerCamp.getId(), brandId, aanya.getId(), true, 2, 70_000.0);
            ensureCampaignCreatorLinked(summerCamp.getId(), brandId, rohan.getId(), true, 1, 48_000.0);
            ensureCampaignCreatorLinked(summerCamp.getId(), brandId, kabir.getId(), true, 2, 90_000.0);
        }
        if (monsoonCamp != null) {
            ensureCampaignCreatorLinked(monsoonCamp.getId(), brandId, rohan.getId(), true, 1, 48_000.0);
            ensureCampaignCreatorLinked(monsoonCamp.getId(), brandId, nisha.getId(), true, 1, 55_000.0);
            ensureCampaignCreatorLinked(monsoonCamp.getId(), brandId, tara.getId(), true, 1, 18_000.0);
        }

        UUID summerId = summerCamp != null ? summerCamp.getId() : null;
        UUID monsoonId = monsoonCamp != null ? monsoonCamp.getId() : null;

        List<ReelDeliverable> createdReels = new ArrayList<>();
        createdReels.add(saveDemoReel(aanya, "Morning Vitamin C Routine", summerId, "Summer Glow Drop", "C0DemoAanya01",
                840_000L, 48_200L, 912L, 3_420L, 35_000.0, 54.2, 16_400L, now.minusSeconds(9 * 86400L)));
        createdReels.add(saveDemoReel(aanya, "7-Day Hydration Test", summerId, "Summer Glow Drop", "C0DemoAanya02",
                310_000L, 19_400L, 418L, 1_290L, 35_000.0, 41.8, 12_800L, now.minusSeconds(4 * 86400L)));
        createdReels.add(saveDemoReel(rohan, "AM Grooming Essentials", summerId, "Summer Glow Drop", "C0DemoRohan01",
                520_000L, 28_600L, 640L, 1_850L, 48_000.0, 47.6, 14_900L, now.minusSeconds(11 * 86400L)));
        createdReels.add(saveDemoReel(rohan, "Travel Kit Breakdown", monsoonId, "Monsoon Creator Wave", "C0DemoRohan02",
                195_000L, 11_200L, 244L, 680L, 48_000.0, 35.4, 10_200L, now.minusSeconds(3 * 86400L)));
        createdReels.add(saveDemoReel(nisha, "Rain-Proof Skincare Layering", monsoonId, "Monsoon Creator Wave", "C0DemoNisha01",
                245_000L, 16_800L, 530L, 1_940L, null, 58.9, 18_300L, now.minusSeconds(6 * 86400L)));
        createdReels.add(saveDemoReel(kabir, "Post-Workout Recovery Ritual", summerId, "Summer Glow Drop", "C0DemoKabir01",
                218_000L, 12_900L, 310L, 820L, null, 38.2, 11_600L, now.minusSeconds(8 * 86400L)));
        createdReels.add(saveDemoReel(kabir, "Unboxing Brand Kit", summerId, "Summer Glow Drop", "C0DemoKabir02",
                142_000L, 7_600L, 198L, 410L, null, 31.5, 9_400L, now.minusSeconds(2 * 86400L)));
        createdReels.add(saveDemoReel(tara, "Honest Texture & SPF Review", monsoonId, "Monsoon Creator Wave", "C0DemoTara01",
                92_000L, 6_450L, 265L, 790L, 18_000.0, 49.0, 15_200L, now.minusSeconds(1 * 86400L)));

        for (Creator dc : createdCreators) {
            rollUpCreatorMetrics(dc);
        }
        if (scopedAgency.isEmpty() && brand.getTargetViewsGoal() == null) {
            brand.setTargetViewsGoal(3_000_000L);
            brand.setUpdatedAt(now);
            brandRepository.save(brand);
        }
        if (scopedAgency.isPresent()) {
            Agency ag = scopedAgency.get();
            ag.setCreatorsCount(creatorRepository.findByAgencyId(ag.getId()).size());
            agencyRepository.save(ag);
        }

        recordAudit(brandId, scopedAgency.map(Agency::getId).orElse(null), "SYSTEM",
                "Demo Campaign Loaded", "Demo Ready",
                "Loaded sample campaign workspace (5 creators, 8 tracked Reels with snapshot growth curves).",
                actor, "Sample Campaign");

        return Map.of(
                "alreadyLoaded", false,
                "creatorsAdded", createdCreators.size(),
                "reelsAdded", createdReels.size()
        );
    }

    private Creator saveDemoCreator(
            UUID brandId,
            Optional<Agency> scopedAgency,
            String name,
            String handle,
            String category,
            String country,
            long followers,
            String followersDisplay,
            String costMode,
            Double costQuoted,
            String campaignName,
            boolean verified) {
        Creator c = new Creator();
        c.setBrandId(brandId);
        if (scopedAgency.isPresent()) {
            Agency ag = scopedAgency.get();
            c.setSourceType("AGENCY");
            c.setAgencyId(ag.getId());
            c.setAgencyName(ag.getName());
        } else {
            c.setSourceType("DIRECT");
            c.setAgencyName("Direct / Independent");
        }
        c.setName(name);
        c.setHandle(handle);
        c.setProfileUrl("https://www.instagram.com/" + InstagramGraphService.stripAt(handle) + "/");
        c.setCategory(category);
        c.setNiche(category);
        c.setCountry(country);
        c.setFollowersCount(followers);
        c.setFollowersDisplay(followersDisplay);
        c.setMediaCount(48);
        c.setFollowsCount(320);
        c.setCostMode(costMode);
        c.setCostQuoted(costQuoted);
        c.setCurrency("INR");
        c.setCampaignName(campaignName);
        c.setVerified(verified);
        c.setPostedLast28Days(true);
        c.setDemoData(true);
        c.setStatus("ACTIVE_VERIFIED");
        return creatorRepository.save(c);
    }

    private ReelDeliverable saveDemoReel(
            Creator creator,
            String title,
            UUID campaignId,
            String campaignTag,
            String shortcode,
            long views,
            long likes,
            long comments,
            long saves,
            Double costQuoted,
            Double hookRatePct,
            long avgWatchTimeMs,
            Instant publishedAt) {
        ReelDeliverable r = new ReelDeliverable();
        r.setBrandId(creator.getBrandId());
        r.setCreatorId(creator.getId());
        r.setCreatorHandle(creator.getHandle());
        r.setTitle(title);
        r.setCampaignId(campaignId);
        r.setCampaignTag(campaignTag);
        r.setShortcode(shortcode);
        r.setReelUrl("https://www.instagram.com/reel/" + shortcode + "/");
        r.setMediaType("REELS");
        r.setCostQuoted(costQuoted);
        r.setViewsCount(views);
        r.setReachCount(views);
        r.setLikesCount(likes);
        r.setCommentsCount(comments);
        r.setSavesCount(saves);
        r.setAvgWatchTimeMs(avgWatchTimeMs);
        if (hookRatePct != null) {
            double hr = Math.round(hookRatePct * 10.0) / 10.0;
            r.setHookRatePct(hr);
            r.setSkipRatePct(Math.round((100.0 - hr) * 10.0) / 10.0);
            r.setHookRateSource("META_GRAPH_INSIGHTS");
        }
        double er = views > 0 ? Math.round(((likes + comments) * 100.0 / views) * 100.0) / 100.0 : 0.0;
        r.setEngagementRate(er);
        r.setStatus("VERIFIED");
        r.setMetricsSource("META_BUSINESS_DISCOVERY");
        r.setPublishedAt(publishedAt);
        r.setSyncedAt(Instant.now());
        r.setDemoData(true);
        ReelDeliverable saved = reelRepository.save(r);

        if (reelSnapshotRepository != null) {
            Instant now = Instant.now();
            double[] ratios = {0.22, 0.44, 0.67, 0.89, 1.0};
            long[] offsetsHours = {72, 48, 24, 6, 0};
            for (int i = 0; i < ratios.length; i++) {
                ReelSnapshot snap = new ReelSnapshot();
                snap.setDeliverableId(saved.getId());
                snap.setBrandId(saved.getBrandId());
                snap.setCreatorId(saved.getCreatorId());
                snap.setViewsCount(Math.round(views * ratios[i]));
                snap.setLikesCount(Math.round(likes * ratios[i]));
                snap.setCommentsCount(Math.round(comments * ratios[i]));
                snap.setSavesCount(Math.round(saves * ratios[i]));
                snap.setHookRatePct(saved.getHookRatePct());
                snap.setCapturedAt(now.minusSeconds(offsetsHours[i] * 3600L));
                reelSnapshotRepository.save(snap);
            }
        }
        return saved;
    }

    @Transactional
    public Map<String, Object> clearDemoCampaign(UUID brandId, Authentication auth) {
        Brand brand = requireBrandAccess(brandId, auth);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        String actor = resolveActor(auth, "Workspace Manager");

        List<Creator> demoCreators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId).stream()
                .filter(Creator::isDemoData)
                .filter(c -> scopedAgency.isEmpty() || creatorBelongsToAgency(c, scopedAgency.get()))
                .toList();
        Set<UUID> demoCreatorIds = new HashSet<>();
        for (Creator dc : demoCreators) {
            if (dc.getId() != null) demoCreatorIds.add(dc.getId());
        }

        List<ReelDeliverable> demoReels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId).stream()
                .filter(r -> r.isDemoData() || (r.getCreatorId() != null && demoCreatorIds.contains(r.getCreatorId())))
                .filter(r -> scopedAgency.isEmpty() || (r.getCreatorId() != null && demoCreatorIds.contains(r.getCreatorId())))
                .toList();

        if (reelSnapshotRepository != null) {
            for (ReelDeliverable dr : demoReels) {
                if (dr.getId() != null) {
                    reelSnapshotRepository.deleteByDeliverableId(dr.getId());
                }
            }
        }
        if (campaignCreatorRepository != null) {
            for (UUID dcId : demoCreatorIds) {
                campaignCreatorRepository.deleteByCreatorId(dcId);
            }
        }
        if (!demoReels.isEmpty()) {
            reelRepository.deleteAll(demoReels);
        }
        if (!demoCreators.isEmpty()) {
            creatorRepository.deleteAll(demoCreators);
        }
        if (campaignRepository != null) {
            List<ReelDeliverable> remainingReels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId);
            List<CampaignCreator> remainingAssignments = campaignCreatorRepository != null
                    ? campaignCreatorRepository.findByBrandId(brandId)
                    : List.of();
            for (Campaign dc : campaignRepository.findByBrandIdOrderByCreatedAtDesc(brandId)) {
                if (!dc.isDemoData()) continue;
                boolean hasRealReels = remainingReels.stream().anyMatch(r -> dc.getId().equals(r.getCampaignId()));
                boolean hasRealCreators = remainingAssignments.stream().anyMatch(a -> dc.getId().equals(a.getCampaignId()));
                if (!hasRealReels && !hasRealCreators) {
                    campaignRepository.delete(dc);
                }
            }
        }
        if (scopedAgency.isPresent()) {
            Agency ag = scopedAgency.get();
            ag.setCreatorsCount(creatorRepository.findByAgencyId(ag.getId()).size());
            agencyRepository.save(ag);
        }

        recordAudit(brandId, scopedAgency.map(Agency::getId).orElse(null), "SYSTEM",
                "Demo Campaign Cleared", "Cleared",
                "Removed " + demoCreators.size() + " sample creator(s) and " + demoReels.size() + " sample reel(s).",
                actor, "Sample Campaign");

        return Map.of("removedCreators", demoCreators.size(), "removedReels", demoReels.size());
    }

    @Transactional
    public SharedReport createSharedReport(UUID brandId, Map<String, Object> payload, Authentication auth) {
        Brand brand = requireBrandAccess(brandId, auth);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        SharedReportRepository repo = requireSharedReportRepository();

        String rawTitle = payload != null ? trimToMax(strVal(payload.get("title")), 140) : "";
        String rawCampaignId = payload != null ? strVal(payload.get("campaignId")) : "";
        Campaign linkedCamp = !rawCampaignId.isEmpty()
                ? resolveCampaignByIdForBrand(brandId, rawCampaignId, scopedAgency.isPresent())
                : null;
        String campaignFilter = linkedCamp != null
                ? linkedCamp.getName()
                : (payload != null ? trimToMax(strVal(payload.get("campaignFilter")), 80) : "ALL");
        if (campaignFilter.isEmpty()) campaignFilter = "ALL";
        if (linkedCamp == null && !"ALL".equalsIgnoreCase(campaignFilter) && campaignRepository != null) {
            linkedCamp = campaignRepository.findByBrandIdAndNameIgnoreCase(brandId, campaignFilter).orElse(null);
        }
        boolean includeSpend = payload == null || payload.get("includeSpend") == null
                || Boolean.parseBoolean(String.valueOf(payload.get("includeSpend")));

        Instant expiresAt = null;
        if (payload != null && payload.get("expiryDays") != null && !strVal(payload.get("expiryDays")).isEmpty()) {
            try {
                int days = Integer.parseInt(strVal(payload.get("expiryDays")));
                if (days > 0) {
                    expiresAt = Instant.now().plusSeconds(Math.min(days, 365) * 86400L);
                }
            } catch (NumberFormatException ignored) {
                throw new IllegalArgumentException("Expiry days must be a valid positive number.");
            }
        }

        SharedReport report = new SharedReport();
        report.setBrandId(brandId);
        report.setAgencyId(scopedAgency.map(Agency::getId).orElse(null));
        report.setShareToken(generateRawActivationToken());
        report.setTitle(rawTitle.isEmpty()
                ? (scopedAgency.map(Agency::getName).orElse(brand.getName()) + " Campaign Report")
                : rawTitle);
        report.setCampaignId(linkedCamp != null ? linkedCamp.getId() : null);
        report.setCampaignFilter(campaignFilter);
        report.setIncludeSpend(includeSpend);
        report.setCreatedBy(resolveActor(auth, "Workspace Manager"));
        report.setActive(true);
        report.setExpiresAt(expiresAt);

        SharedReport saved = repo.save(report);
        recordAudit(brandId, scopedAgency.map(Agency::getId).orElse(null), "SYSTEM",
                "Client Report Link Created", "Shared",
                "Generated shareable client report link: " + saved.getTitle() + ".",
                saved.getCreatedBy(), "Client Share");
        return saved;
    }

    public List<SharedReport> listSharedReports(UUID brandId, Authentication auth) {
        Brand brand = requireBrandAccess(brandId, auth);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        SharedReportRepository repo = requireSharedReportRepository();
        return repo.findByBrandIdAndActiveTrueOrderByCreatedAtDesc(brandId).stream()
                .filter(r -> r.getExpiresAt() == null || r.getExpiresAt().isAfter(Instant.now()))
                .filter(r -> scopedAgency.isEmpty() || (r.getAgencyId() != null && r.getAgencyId().equals(scopedAgency.get().getId())))
                .toList();
    }

    @Transactional
    public void revokeSharedReport(UUID brandId, UUID reportId, Authentication auth) {
        Brand brand = requireBrandAccess(brandId, auth);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        SharedReportRepository repo = requireSharedReportRepository();
        SharedReport report = repo.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("Shared report not found."));
        if (!brandId.equals(report.getBrandId())) {
            throw new AccessDeniedException("Report does not belong to this workspace.");
        }
        if (scopedAgency.isPresent()
                && (report.getAgencyId() == null || !report.getAgencyId().equals(scopedAgency.get().getId()))) {
            throw new AccessDeniedException("You can only revoke report links created by your agency.");
        }
        report.setActive(false);
        repo.save(report);
    }

    public Map<String, Object> getPublicSharedReport(String shareToken) {
        if (shareToken == null || !shareToken.trim().matches("^[A-Za-z0-9_-]{16,128}$")) {
            throw new IllegalArgumentException("This report link is invalid or has expired.");
        }
        SharedReportRepository repo = requireSharedReportRepository();
        SharedReport report = repo.findByShareTokenAndActiveTrue(shareToken.trim())
                .orElseThrow(() -> new IllegalArgumentException("This report link is invalid or has been revoked."));
        if (report.getExpiresAt() != null && report.getExpiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("This shared report link has expired.");
        }

        Brand brand = getBrand(report.getBrandId());
        if ("DRAFT".equalsIgnoreCase(brand.getStatus())) {
            throw new IllegalArgumentException("This workspace report is currently unavailable.");
        }

        Agency scopedAgency = report.getAgencyId() != null
                ? agencyRepository.findById(report.getAgencyId()).orElse(null)
                : null;
        if (report.getAgencyId() != null && scopedAgency == null) {
            throw new IllegalArgumentException("This agency report link is no longer active.");
        }

        List<Creator> creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brand.getId()).stream()
                .filter(c -> scopedAgency == null || creatorBelongsToAgency(c, scopedAgency))
                .toList();
        Map<UUID, Creator> creatorMap = new LinkedHashMap<>();
        for (Creator c : creators) {
            creatorMap.put(c.getId(), c);
        }

        List<ReelDeliverable> allScopedReels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brand.getId()).stream()
                .filter(r -> scopedAgency == null || (r.getCreatorId() != null && creatorMap.containsKey(r.getCreatorId())))
                .toList();

        Campaign scopedCampaign = (report.getCampaignId() != null && campaignRepository != null)
                ? campaignRepository.findById(report.getCampaignId()).orElse(null)
                : null;
        String campaignFilter = scopedCampaign != null ? scopedCampaign.getName() : report.getCampaignFilter();
        boolean hasCampaignFilter = scopedCampaign != null
                || (campaignFilter != null && !campaignFilter.isBlank() && !"ALL".equalsIgnoreCase(campaignFilter));

        UUID targetCampId = scopedCampaign != null ? scopedCampaign.getId() : null;
        List<ReelDeliverable> filteredReels = hasCampaignFilter
                ? allScopedReels.stream()
                        .filter(r -> (targetCampId != null && targetCampId.equals(r.getCampaignId()))
                                || effectiveCampaign(r, creatorMap.get(r.getCreatorId())).equalsIgnoreCase(campaignFilter))
                        .toList()
                : allScopedReels;

        Map<UUID, List<ReelDeliverable>> reelsByCreator = new HashMap<>();
        for (ReelDeliverable r : filteredReels) {
            reelsByCreator.computeIfAbsent(r.getCreatorId(), k -> new ArrayList<>()).add(r);
        }

        Set<UUID> assignedCreatorIds = new HashSet<>();
        if (targetCampId != null && campaignCreatorRepository != null) {
            for (CampaignCreator cc : campaignCreatorRepository.findByCampaignIdOrderByAssignedAtDesc(targetCampId)) {
                if (cc.getCreatorId() != null) assignedCreatorIds.add(cc.getCreatorId());
            }
        }

        List<Creator> filteredCreators = hasCampaignFilter
                ? creators.stream()
                        .filter(c -> assignedCreatorIds.contains(c.getId())
                                || creatorMatchesCampaign(c, reelsByCreator.getOrDefault(c.getId(), List.of()), campaignFilter))
                        .toList()
                : creators;

        boolean includeSpend = report.isIncludeSpend();

        Long effectiveTargetGoal = null;
        if (scopedAgency == null) {
            if (scopedCampaign != null && scopedCampaign.getTargetViewsGoal() != null) {
                effectiveTargetGoal = scopedCampaign.getTargetViewsGoal();
            } else if (!hasCampaignFilter) {
                effectiveTargetGoal = brand.getTargetViewsGoal();
            }
        }

        Map<String, Object> safeBrand = new LinkedHashMap<>();
        safeBrand.put("name", scopedAgency != null ? scopedAgency.getName() : brand.getName());
        safeBrand.put("brandName", brand.getName());
        safeBrand.put("slug", brand.getSlug());
        safeBrand.put("currency", brand.getCurrency());
        safeBrand.put("targetViewsGoal", effectiveTargetGoal);

        List<Map<String, Object>> safeCreators = filteredCreators.stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("name", c.getName());
            m.put("handle", c.getHandle());
            m.put("avatarUrl", c.getAvatarUrl());
            m.put("profileUrl", c.getProfileUrl());
            m.put("category", c.getCategory());
            m.put("niche", c.getNiche());
            m.put("country", c.getCountry());
            m.put("followersDisplay", c.getFollowersDisplay());
            m.put("followersCount", c.getFollowersCount());
            m.put("verified", c.isVerified());
            m.put("campaignName", c.getCampaignName());
            m.put("sourceType", c.getSourceType());
            m.put("agencyName", c.getAgencyName());
            m.put("costMode", c.getCostMode());
            m.put("costQuoted", includeSpend ? c.getCostQuoted() : null);
            m.put("currency", c.getCurrency());
            m.put("auditedReelsCount", c.getAuditedReelsCount());
            m.put("engagementRate", c.getEngagementRate());
            m.put("interactionRate90d", c.getInteractionRate90d());
            m.put("hookRate90d", c.getHookRate90d());
            return m;
        }).toList();

        List<Map<String, Object>> safeReels = filteredReels.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("creatorId", r.getCreatorId());
            m.put("creatorHandle", r.getCreatorHandle());
            m.put("title", r.getTitle());
            m.put("campaignTag", effectiveCampaign(r, creatorMap.get(r.getCreatorId())));
            m.put("reelUrl", r.getReelUrl());
            m.put("mediaType", r.getMediaType());
            m.put("thumbnailUrl", r.getThumbnailUrl());
            m.put("viewsCount", r.getViewsCount());
            m.put("reachCount", r.getReachCount());
            m.put("likesCount", r.getLikesCount());
            m.put("commentsCount", r.getCommentsCount());
            m.put("savesCount", r.getSavesCount());
            m.put("sharesCount", r.getSharesCount());
            m.put("hookRatePct", r.getHookRatePct());
            m.put("skipRatePct", r.getSkipRatePct());
            m.put("hookRateSource", r.getHookRateSource());
            m.put("engagementRate", r.getEngagementRate());
            m.put("status", r.getStatus());
            m.put("publishedAt", r.getPublishedAt());
            m.put("syncedAt", r.getSyncedAt());
            m.put("costQuoted", includeSpend ? r.getCostQuoted() : null);
            return m;
        }).toList();

        InstagramGraphService.HookRateRollup reportHook = InstagramGraphService.computeViewWeightedHookRate(filteredReels);
        Map<String, Object> reportMeta = new LinkedHashMap<>();
        reportMeta.put("title", report.getTitle());
        reportMeta.put("campaignFilter", campaignFilter);
        reportMeta.put("includeSpend", includeSpend);
        reportMeta.put("avgHookRatePct", reportHook.avgHookRatePct());
        reportMeta.put("hookMeasuredReelsCount", reportHook.measuredReelsCount());
        reportMeta.put("createdAt", report.getCreatedAt());
        reportMeta.put("expiresAt", report.getExpiresAt() != null ? report.getExpiresAt().toString() : "");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("report", reportMeta);
        out.put("brand", safeBrand);
        out.put("creators", safeCreators);
        out.put("deliverables", safeReels);
        out.put("reelDeltas", buildBrandReelDeltasMap(brand.getId(), filteredReels));
        return out;
    }

    private SharedReportRepository requireSharedReportRepository() {
        if (sharedReportRepository == null) {
            throw new IllegalStateException("Shared reports feature is unavailable.");
        }
        return sharedReportRepository;
    }

    private String effectiveCampaign(ReelDeliverable reel, Creator creator) {
        if (reel != null && reel.getCampaignTag() != null && !reel.getCampaignTag().isBlank()) {
            return reel.getCampaignTag().trim();
        }
        if (creator != null && creator.getCampaignName() != null && !creator.getCampaignName().isBlank()) {
            return creator.getCampaignName().trim();
        }
        return "";
    }

    private boolean creatorMatchesCampaign(Creator creator, List<ReelDeliverable> reels, String campaign) {
        if (creator != null && creator.getCampaignName() != null
                && creator.getCampaignName().trim().equalsIgnoreCase(campaign)) {
            return true;
        }
        for (ReelDeliverable r : reels) {
            if (effectiveCampaign(r, creator).equalsIgnoreCase(campaign)) {
                return true;
            }
        }
        return false;
    }

    public static String trimToMax(String val, int maxLen) {
        if (val == null) return "";
        String t = val.trim();
        return t.length() > maxLen ? t.substring(0, maxLen) : t;
    }

    public Campaign resolveCampaignByIdForBrand(UUID brandId, String rawCampaignId, boolean rejectDraft) {
        if (campaignRepository == null || rawCampaignId == null || rawCampaignId.isBlank()) {
            return null;
        }
        UUID cid;
        try {
            cid = UUID.fromString(rawCampaignId.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid campaign ID.");
        }
        Campaign campaign = campaignRepository.findById(cid)
                .orElseThrow(() -> new IllegalArgumentException("Campaign not found."));
        if (!brandId.equals(campaign.getBrandId())) {
            throw new AccessDeniedException("Campaign does not belong to this workspace.");
        }
        if (rejectDraft && "DRAFT".equalsIgnoreCase(campaign.getStatus())) {
            throw new AccessDeniedException("This campaign is currently in draft status.");
        }
        return campaign;
    }

    private Campaign resolveCampaignForDeliverable(
            UUID brandId,
            String rawCampaignId,
            String rawCampaignTag,
            String creatorCampaignName,
            String actor,
            boolean autoCreateIfMissing) {
        if (campaignRepository == null) return null;
        if (rawCampaignId != null && !rawCampaignId.isBlank()) {
            return resolveCampaignByIdForBrand(brandId, rawCampaignId, false);
        }
        String candidate = trimToMax(rawCampaignTag, 80);
        if (candidate.isEmpty()) candidate = trimToMax(creatorCampaignName, 80);
        if (candidate.isEmpty()) return null;

        Optional<Campaign> existing = campaignRepository.findByBrandIdAndNameIgnoreCase(brandId, candidate);
        if (existing.isPresent()) {
            return existing.get();
        }
        if (!autoCreateIfMissing) {
            return null;
        }
        Campaign camp = new Campaign();
        camp.setBrandId(brandId);
        camp.setName(candidate);
        camp.setStatus("ACTIVE");
        camp.setCreatedAt(Instant.now());
        camp.setUpdatedAt(Instant.now());
        return campaignRepository.save(camp);
    }

    public CampaignCreator ensureCampaignCreatorLinked(
            UUID campaignId,
            UUID brandId,
            UUID creatorId,
            boolean demoData,
            int expectedReels,
            Double agreedCost) {
        if (campaignCreatorRepository == null || campaignId == null || creatorId == null) {
            return null;
        }
        Optional<CampaignCreator> existing = campaignCreatorRepository.findByCampaignIdAndCreatorId(campaignId, creatorId);
        if (existing.isPresent()) {
            return existing.get();
        }
        CampaignCreator cc = new CampaignCreator();
        cc.setCampaignId(campaignId);
        cc.setBrandId(brandId);
        cc.setCreatorId(creatorId);
        cc.setDemoData(demoData);
        cc.setExpectedReels(Math.max(1, expectedReels));
        if (agreedCost != null && agreedCost > 0) {
            cc.setAgreedCost(agreedCost);
        }
        return campaignCreatorRepository.save(cc);
    }

    private Campaign ensureDemoCampaignRecord(
            UUID brandId,
            String name,
            Double budgetAmount,
            Long targetViewsGoal,
            String briefNotes,
            long startOffsetDays,
            long endOffsetDays) {
        if (campaignRepository == null) return null;
        Optional<Campaign> existing = campaignRepository.findByBrandIdAndNameIgnoreCase(brandId, name);
        if (existing.isPresent()) {
            return existing.get();
        }
        Campaign c = new Campaign();
        c.setBrandId(brandId);
        c.setName(name);
        c.setStatus("ACTIVE");
        c.setBudgetAmount(budgetAmount);
        c.setTargetViewsGoal(targetViewsGoal);
        c.setBriefNotes(briefNotes);
        LocalDate today = LocalDate.now();
        c.setStartDate(today.plusDays(startOffsetDays));
        c.setEndDate(today.plusDays(endOffsetDays));
        c.setDemoData(true);
        return campaignRepository.save(c);
    }

    /**
     * Automatically promotes legacy free-text campaign names/tags on Creators and Deliverables
     * into first-class Campaign & CampaignCreator records so existing workspaces keep all history.
     */
    @Transactional
    public void ensureLegacyCampaignsMigrated(UUID brandId) {
        if (campaignRepository == null || campaignCreatorRepository == null || brandId == null) {
            return;
        }
        List<Campaign> existingCampaigns = new ArrayList<>(campaignRepository.findByBrandIdOrderByCreatedAtDesc(brandId));
        Map<String, Campaign> byLowerName = new LinkedHashMap<>();
        Map<UUID, Campaign> byId = new LinkedHashMap<>();
        for (Campaign c : existingCampaigns) {
            if (c.getId() != null) byId.put(c.getId(), c);
            if (c.getName() != null && !c.getName().isBlank()) {
                byLowerName.putIfAbsent(c.getName().trim().toLowerCase(Locale.ROOT), c);
            }
        }

        List<Creator> creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId);
        Map<UUID, Creator> creatorById = new HashMap<>();
        for (Creator c : creators) {
            if (c.getId() != null) creatorById.put(c.getId(), c);
            String cName = trimToMax(c.getCampaignName(), 80);
            if (!cName.isEmpty() && !"Untagged / General".equalsIgnoreCase(cName)) {
                Campaign camp = findOrPromoteCampaign(brandId, cName, c.isDemoData(), byLowerName, byId);
                ensureCampaignCreatorLinked(camp.getId(), brandId, c.getId(), c.isDemoData(), 1, null);
            }
        }

        List<ReelDeliverable> reels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId);
        List<ReelDeliverable> dirtyReels = new ArrayList<>();
        for (ReelDeliverable r : reels) {
            Creator parent = creatorById.get(r.getCreatorId());
            if (r.getCampaignId() != null && byId.containsKey(r.getCampaignId())) {
                Campaign linked = byId.get(r.getCampaignId());
                if (!linked.getName().equals(r.getCampaignTag())) {
                    r.setCampaignTag(linked.getName());
                    dirtyReels.add(r);
                }
                if (parent != null) {
                    ensureCampaignCreatorLinked(linked.getId(), brandId, parent.getId(),
                            r.isDemoData() || parent.isDemoData(), 1, null);
                }
                continue;
            }
            String effTag = trimToMax(effectiveCampaign(r, parent), 80);
            if (!effTag.isEmpty() && !"Untagged / General".equalsIgnoreCase(effTag)) {
                boolean isDemo = r.isDemoData() || (parent != null && parent.isDemoData());
                Campaign camp = findOrPromoteCampaign(brandId, effTag, isDemo, byLowerName, byId);
                r.setCampaignId(camp.getId());
                r.setCampaignTag(camp.getName());
                dirtyReels.add(r);
                if (parent != null) {
                    ensureCampaignCreatorLinked(camp.getId(), brandId, parent.getId(), isDemo, 1, null);
                }
            }
        }
        if (!dirtyReels.isEmpty()) {
            reelRepository.saveAll(dirtyReels);
        }
    }

    private Campaign findOrPromoteCampaign(
            UUID brandId,
            String name,
            boolean isDemo,
            Map<String, Campaign> byLowerName,
            Map<UUID, Campaign> byId) {
        String key = name.trim().toLowerCase(Locale.ROOT);
        Campaign existing = byLowerName.get(key);
        if (existing != null) return existing;

        Campaign created = new Campaign();
        created.setBrandId(brandId);
        created.setName(name.trim());
        created.setStatus("ACTIVE");
        created.setDemoData(isDemo);
        Campaign saved = campaignRepository.save(created);
        byLowerName.put(key, saved);
        if (saved.getId() != null) byId.put(saved.getId(), saved);
        return saved;
    }

    @Transactional
    public List<Map<String, Object>> listScopedCampaignSummaries(UUID brandId, Authentication auth) {
        Brand brand = getBrand(brandId);
        ensureLegacyCampaignsMigrated(brandId);
        Optional<Agency> scopedAgency = resolveScopedAgencyForCaller(brand, auth);
        List<Creator> creators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId).stream()
                .filter(c -> scopedAgency.isEmpty() || creatorBelongsToAgency(c, scopedAgency.get()))
                .toList();
        Set<UUID> allowedCreatorIds = new HashSet<>();
        for (Creator c : creators) {
            if (c.getId() != null) allowedCreatorIds.add(c.getId());
        }
        List<ReelDeliverable> reels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId).stream()
                .filter(r -> scopedAgency.isEmpty() || (r.getCreatorId() != null && allowedCreatorIds.contains(r.getCreatorId())))
                .toList();
        return buildCampaignSummariesList(brandId, scopedAgency, creators, reels);
    }

    public List<Map<String, Object>> buildCampaignSummariesList(
            UUID brandId,
            Optional<Agency> scopedAgency,
            List<Creator> scopedCreators,
            List<ReelDeliverable> scopedReels) {
        if (campaignRepository == null) return List.of();

        List<Campaign> allCampaigns = campaignRepository.findByBrandIdOrderByCreatedAtDesc(brandId).stream()
                .filter(c -> scopedAgency.isEmpty() || !"DRAFT".equalsIgnoreCase(c.getStatus()))
                .toList();
        if (allCampaigns.isEmpty()) return List.of();

        Map<UUID, Creator> creatorMap = new LinkedHashMap<>();
        for (Creator c : scopedCreators) {
            if (c.getId() != null) creatorMap.put(c.getId(), c);
        }

        List<CampaignCreator> allAssignments = campaignCreatorRepository != null
                ? campaignCreatorRepository.findByBrandId(brandId)
                : List.of();
        Map<UUID, List<CampaignCreator>> assignmentsByCamp = new HashMap<>();
        for (CampaignCreator cc : allAssignments) {
            if (scopedAgency.isPresent() && !creatorMap.containsKey(cc.getCreatorId())) continue;
            assignmentsByCamp.computeIfAbsent(cc.getCampaignId(), k -> new ArrayList<>()).add(cc);
        }

        Map<UUID, List<ReelDeliverable>> reelsByCamp = new HashMap<>();
        Map<UUID, Integer> totalReelsByCreator = new HashMap<>();
        for (ReelDeliverable r : scopedReels) {
            totalReelsByCreator.merge(r.getCreatorId(), 1, Integer::sum);
            UUID cid = r.getCampaignId();
            if (cid != null) {
                reelsByCamp.computeIfAbsent(cid, k -> new ArrayList<>()).add(r);
            }
        }

        List<Map<String, Object>> summaries = new ArrayList<>();
        for (Campaign camp : allCampaigns) {
            List<ReelDeliverable> campReels = new ArrayList<>(reelsByCamp.getOrDefault(camp.getId(), List.of()));
            for (ReelDeliverable r : scopedReels) {
                if (r.getCampaignId() == null && camp.getName().equalsIgnoreCase(effectiveCampaign(r, creatorMap.get(r.getCreatorId())))) {
                    campReels.add(r);
                }
            }

            List<CampaignCreator> campAssignments = assignmentsByCamp.getOrDefault(camp.getId(), List.of());
            Map<UUID, CampaignCreator> assignmentByCreator = new HashMap<>();
            Set<UUID> creatorIdsInCamp = new LinkedHashSet<>();
            for (CampaignCreator cc : campAssignments) {
                if (creatorMap.containsKey(cc.getCreatorId())) {
                    creatorIdsInCamp.add(cc.getCreatorId());
                    assignmentByCreator.put(cc.getCreatorId(), cc);
                }
            }
            for (ReelDeliverable r : campReels) {
                if (r.getCreatorId() != null && creatorMap.containsKey(r.getCreatorId())) {
                    creatorIdsInCamp.add(r.getCreatorId());
                }
            }

            long views = 0;
            long interactions = 0;
            for (ReelDeliverable r : campReels) {
                views += r.getViewsCount();
                interactions += r.getLikesCount() + r.getCommentsCount();
            }

            double spend = computeCampaignSpend(creatorIdsInCamp, assignmentByCreator, creatorMap, campReels, totalReelsByCreator);
            double cpv = (spend > 0 && views > 0) ? Math.round((spend / views) * 100.0) / 100.0 : 0.0;
            double engRate = (views > 0 && interactions > 0) ? Math.round((interactions * 100.0 / views) * 100.0) / 100.0 : 0.0;
            InstagramGraphService.HookRateRollup campHook = InstagramGraphService.computeViewWeightedHookRate(campReels);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", camp.getId());
            row.put("brandId", camp.getBrandId());
            row.put("name", camp.getName());
            row.put("status", camp.getStatus());
            row.put("budgetAmount", camp.getBudgetAmount());
            row.put("targetViewsGoal", camp.getTargetViewsGoal());
            row.put("startDate", camp.getStartDate());
            row.put("endDate", camp.getEndDate());
            row.put("briefNotes", camp.getBriefNotes());
            row.put("demoData", camp.isDemoData());
            row.put("createdAt", camp.getCreatedAt());
            row.put("creatorsCount", creatorIdsInCamp.size());
            row.put("reelsCount", campReels.size());
            row.put("viewsCount", views);
            row.put("interactionsCount", interactions);
            row.put("spendAmount", Math.round(spend));
            row.put("blendedCpv", cpv > 0 ? cpv : null);
            row.put("engagementRate", engRate);
            row.put("avgHookRatePct", campHook.avgHookRatePct());
            row.put("hookMeasuredReelsCount", campHook.measuredReelsCount());
            summaries.add(row);
        }
        return summaries;
    }

    /**
     * Applies optional manual {@code hookRatePct} / {@code skipRatePct} overrides (0–100%)
     * for non-OAuth creators or IG Insights screenshot imports. Blank strings clear manual fields.
     */
    public void applyManualHookRateFromPayload(ReelDeliverable reel, Map<?, ?> payload) {
        if (reel == null || payload == null) return;
        boolean hasHookKey = payload.containsKey("hookRatePct") || payload.containsKey("hookRate");
        boolean hasSkipKey = payload.containsKey("skipRatePct");
        if (!hasHookKey && !hasSkipKey) return;

        Object rawObj = payload.containsKey("hookRatePct")
                ? payload.get("hookRatePct")
                : (payload.containsKey("hookRate") ? payload.get("hookRate") : payload.get("skipRatePct"));
        boolean isSkipInput = !hasHookKey && hasSkipKey;

        String rawStr = strVal(rawObj).replace("%", "").replaceAll("\\s+", "");
        if (rawStr.isEmpty()) {
            reel.setHookRatePct(null);
            reel.setSkipRatePct(null);
            reel.setHookRateSource(null);
            return;
        }
        double parsed;
        try {
            parsed = Double.parseDouble(rawStr);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Hook rate must be a number between 0 and 100.");
        }
        if (!Double.isFinite(parsed) || parsed < 0.0 || parsed > 100.0) {
            throw new IllegalArgumentException("Hook rate must be between 0% and 100%.");
        }
        double rounded = Math.round(parsed * 10.0) / 10.0;
        if (isSkipInput) {
            reel.setSkipRatePct(rounded);
            reel.setHookRatePct(Math.round((100.0 - rounded) * 10.0) / 10.0);
        } else {
            reel.setHookRatePct(rounded);
            reel.setSkipRatePct(Math.round((100.0 - rounded) * 10.0) / 10.0);
        }
        reel.setHookRateSource("MANUAL");
    }

    public double computeCampaignSpend(
            Set<UUID> creatorIdsInCamp,
            Map<UUID, CampaignCreator> assignmentByCreator,
            Map<UUID, Creator> creatorMap,
            List<ReelDeliverable> campReels,
            Map<UUID, Integer> totalReelsByCreator) {
        Map<UUID, List<ReelDeliverable>> campReelsByCreator = new HashMap<>();
        for (ReelDeliverable r : campReels) {
            campReelsByCreator.computeIfAbsent(r.getCreatorId(), k -> new ArrayList<>()).add(r);
        }
        double spend = 0.0;
        for (UUID cid : creatorIdsInCamp) {
            CampaignCreator cc = assignmentByCreator.get(cid);
            if (cc != null && cc.getAgreedCost() != null && cc.getAgreedCost() > 0) {
                spend += cc.getAgreedCost();
                continue;
            }
            Creator c = creatorMap.get(cid);
            if (c == null) continue;
            List<ReelDeliverable> cReels = campReelsByCreator.getOrDefault(cid, List.of());
            if ("PER_DELIVERABLE".equals(c.getCostMode())) {
                for (ReelDeliverable r : cReels) {
                    Double rc = (r.getCostQuoted() != null && r.getCostQuoted() > 0) ? r.getCostQuoted() : c.getCostQuoted();
                    if (rc != null && rc > 0) spend += rc;
                }
            } else if (c.getCostQuoted() != null && c.getCostQuoted() > 0) {
                int totalOwned = Math.max(1, totalReelsByCreator.getOrDefault(cid, Math.max(1, cReels.size())));
                spend += cReels.isEmpty() ? 0.0 : (c.getCostQuoted() * cReels.size() / totalOwned);
            }
        }
        return spend;
    }
}
