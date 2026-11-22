package com.converge.service;

import com.converge.entity.*;
import com.converge.repository.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class CampaignService {

    private static final Set<String> VALID_CAMPAIGN_STATUSES = Set.of("ACTIVE", "PLANNING", "COMPLETED", "DRAFT");

    private final CampaignRepository campaignRepository;
    private final CampaignCreatorRepository campaignCreatorRepository;
    private final BrandRepository brandRepository;
    private final CreatorRepository creatorRepository;
    private final ReelDeliverableRepository reelRepository;
    private final SharedReportRepository sharedReportRepository;
    private final BrandService brandService;

    public CampaignService(
            CampaignRepository campaignRepository,
            CampaignCreatorRepository campaignCreatorRepository,
            BrandRepository brandRepository,
            CreatorRepository creatorRepository,
            ReelDeliverableRepository reelRepository,
            SharedReportRepository sharedReportRepository,
            BrandService brandService) {
        this.campaignRepository = campaignRepository;
        this.campaignCreatorRepository = campaignCreatorRepository;
        this.brandRepository = brandRepository;
        this.creatorRepository = creatorRepository;
        this.reelRepository = reelRepository;
        this.sharedReportRepository = sharedReportRepository;
        this.brandService = brandService;
    }

    public List<Map<String, Object>> listCampaigns(UUID brandId, Authentication auth) {
        brandService.requireBrandAccess(brandId, auth);
        return brandService.listScopedCampaignSummaries(brandId, auth);
    }

    @Transactional
    public Map<String, Object> createCampaign(UUID brandId, Map<String, Object> payload, Authentication auth) {
        brandService.requireBrandOwnerAccess(brandId, auth);
        if (payload == null) {
            throw new IllegalArgumentException("Campaign details are required.");
        }

        String name = BrandService.trimToMax(brandService.strVal(payload.get("name")), 120);
        if (name.length() < 2) {
            throw new IllegalArgumentException("Campaign name must be at least 2 characters.");
        }
        if (campaignRepository.findByBrandIdAndNameIgnoreCase(brandId, name).isPresent()) {
            throw new IllegalArgumentException("A campaign named \"" + name + "\" already exists in this workspace.");
        }

        String status = normalizeCampaignStatus(brandService.strVal(payload.get("status")));
        Double budgetAmount = payload.get("budgetAmount") != null && !brandService.strVal(payload.get("budgetAmount")).isEmpty()
                ? brandService.parseNullablePositiveDouble(payload.get("budgetAmount"))
                : null;
        Long targetGoal = parseOptionalTargetGoal(payload.get("targetViewsGoal"));
        LocalDate startDate = parseOptionalDate(payload.get("startDate"), "Start date");
        LocalDate endDate = parseOptionalDate(payload.get("endDate"), "End date");
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("End date cannot be earlier than start date.");
        }
        String briefNotes = BrandService.trimToMax(brandService.strVal(payload.get("briefNotes")), 2000);

        Campaign camp = new Campaign();
        camp.setBrandId(brandId);
        camp.setName(name);
        camp.setStatus(status);
        camp.setBudgetAmount(budgetAmount);
        camp.setTargetViewsGoal(targetGoal);
        camp.setStartDate(startDate);
        camp.setEndDate(endDate);
        camp.setBriefNotes(briefNotes);
        camp.setCreatedAt(Instant.now());
        camp.setUpdatedAt(Instant.now());

        Campaign saved = campaignRepository.save(camp);
        String actor = brandService.resolveActor(auth, "Brand Manager");
        brandService.recordAudit(brandId, "SYSTEM", "Campaign Created", status,
                "Created campaign \"" + saved.getName() + "\".",
                actor, "Campaigns");

        return getCampaignDetail(saved.getId(), auth);
    }

    @Transactional
    public Map<String, Object> updateCampaign(UUID campaignId, Map<String, Object> payload, Authentication auth) {
        Campaign camp = getCampaignEntity(campaignId);
        brandService.requireBrandOwnerAccess(camp.getBrandId(), auth);
        if (payload == null) {
            throw new IllegalArgumentException("Campaign update payload is required.");
        }

        String oldName = camp.getName();
        boolean nameChanged = false;
        if (payload.containsKey("name")) {
            String nextName = BrandService.trimToMax(brandService.strVal(payload.get("name")), 120);
            if (nextName.length() < 2) {
                throw new IllegalArgumentException("Campaign name must be at least 2 characters.");
            }
            Optional<Campaign> dup = campaignRepository.findByBrandIdAndNameIgnoreCase(camp.getBrandId(), nextName);
            if (dup.isPresent() && !dup.get().getId().equals(campaignId)) {
                throw new IllegalArgumentException("A campaign named \"" + nextName + "\" already exists in this workspace.");
            }
            if (!nextName.equals(oldName)) {
                camp.setName(nextName);
                nameChanged = true;
            }
        }

        if (payload.containsKey("status")) {
            camp.setStatus(normalizeCampaignStatus(brandService.strVal(payload.get("status"))));
        }
        if (payload.containsKey("budgetAmount")) {
            String raw = brandService.strVal(payload.get("budgetAmount"));
            camp.setBudgetAmount(raw.isEmpty() ? null : brandService.parseNullablePositiveDouble(payload.get("budgetAmount")));
        }
        if (payload.containsKey("targetViewsGoal")) {
            camp.setTargetViewsGoal(parseOptionalTargetGoal(payload.get("targetViewsGoal")));
        }
        if (payload.containsKey("startDate")) {
            camp.setStartDate(parseOptionalDate(payload.get("startDate"), "Start date"));
        }
        if (payload.containsKey("endDate")) {
            camp.setEndDate(parseOptionalDate(payload.get("endDate"), "End date"));
        }
        if (camp.getStartDate() != null && camp.getEndDate() != null && camp.getEndDate().isBefore(camp.getStartDate())) {
            throw new IllegalArgumentException("End date cannot be earlier than start date.");
        }
        if (payload.containsKey("briefNotes")) {
            camp.setBriefNotes(BrandService.trimToMax(brandService.strVal(payload.get("briefNotes")), 2000));
        }

        camp.setUpdatedAt(Instant.now());
        Campaign saved = campaignRepository.save(camp);

        if (nameChanged) {
            List<ReelDeliverable> linkedReels = reelRepository.findByBrandIdOrderBySyncedAtDesc(saved.getBrandId()).stream()
                    .filter(r -> saved.getId().equals(r.getCampaignId()))
                    .toList();
            if (!linkedReels.isEmpty()) {
                for (ReelDeliverable r : linkedReels) {
                    r.setCampaignTag(saved.getName());
                }
                reelRepository.saveAll(linkedReels);
            }
            if (sharedReportRepository != null) {
                List<SharedReport> reports = sharedReportRepository.findByBrandIdAndActiveTrueOrderByCreatedAtDesc(saved.getBrandId()).stream()
                        .filter(sr -> saved.getId().equals(sr.getCampaignId()))
                        .toList();
                if (!reports.isEmpty()) {
                    for (SharedReport sr : reports) {
                        sr.setCampaignFilter(saved.getName());
                    }
                    sharedReportRepository.saveAll(reports);
                }
            }
        }

        String actor = brandService.resolveActor(auth, "Brand Manager");
        brandService.recordAudit(saved.getBrandId(), "SYSTEM", "Campaign Updated", "Updated",
                "Updated campaign details for \"" + saved.getName() + "\".",
                actor, "Campaigns");

        return getCampaignDetail(saved.getId(), auth);
    }

    @Transactional
    public void deleteCampaign(UUID campaignId, Authentication auth) {
        Campaign camp = getCampaignEntity(campaignId);
        brandService.requireBrandOwnerAccess(camp.getBrandId(), auth);

        List<ReelDeliverable> linkedReels = reelRepository.findByBrandIdOrderBySyncedAtDesc(camp.getBrandId()).stream()
                .filter(r -> campaignId.equals(r.getCampaignId()))
                .toList();
        if (!linkedReels.isEmpty()) {
            for (ReelDeliverable r : linkedReels) {
                r.setCampaignId(null);
                r.setCampaignTag("");
            }
            reelRepository.saveAll(linkedReels);
        }

        if (sharedReportRepository != null) {
            List<SharedReport> linkedReports = sharedReportRepository.findByBrandIdAndActiveTrueOrderByCreatedAtDesc(camp.getBrandId()).stream()
                    .filter(sr -> campaignId.equals(sr.getCampaignId()))
                    .toList();
            if (!linkedReports.isEmpty()) {
                for (SharedReport sr : linkedReports) {
                    sr.setCampaignId(null);
                }
                sharedReportRepository.saveAll(linkedReports);
            }
        }

        campaignCreatorRepository.deleteByCampaignId(campaignId);
        campaignRepository.delete(camp);

        String actor = brandService.resolveActor(auth, "Brand Manager");
        brandService.recordAudit(camp.getBrandId(), "SYSTEM", "Campaign Deleted", "Removed",
                "Removed campaign \"" + camp.getName() + "\" (synced Reels retained).",
                actor, "Campaigns");
    }

    @Transactional
    public Map<String, Object> getCampaignDetail(UUID campaignId, Authentication auth) {
        Campaign camp = getCampaignEntity(campaignId);
        Brand brand = brandService.requireBrandAccess(camp.getBrandId(), auth);
        brandService.ensureLegacyCampaignsMigrated(brand.getId());
        Optional<Agency> scopedAgency = brandService.resolveScopedAgencyForCaller(brand, auth);
        if (scopedAgency.isPresent() && "DRAFT".equalsIgnoreCase(camp.getStatus())) {
            throw new AccessDeniedException("This campaign is currently in draft status.");
        }

        List<Creator> allBrandCreators = creatorRepository.findByBrandIdOrderByLinkedAtDesc(brand.getId()).stream()
                .filter(c -> scopedAgency.isEmpty() || BrandService.creatorBelongsToAgency(c, scopedAgency.get()))
                .toList();
        Map<UUID, Creator> creatorMap = new LinkedHashMap<>();
        for (Creator c : allBrandCreators) {
            if (c.getId() != null) creatorMap.put(c.getId(), c);
        }

        List<ReelDeliverable> allScopedReels = reelRepository.findByBrandIdOrderBySyncedAtDesc(brand.getId()).stream()
                .filter(r -> scopedAgency.isEmpty() || (r.getCreatorId() != null && creatorMap.containsKey(r.getCreatorId())))
                .toList();
        Map<UUID, Integer> totalReelsByCreator = new HashMap<>();
        for (ReelDeliverable r : allScopedReels) {
            totalReelsByCreator.merge(r.getCreatorId(), 1, Integer::sum);
        }

        List<ReelDeliverable> campReels = allScopedReels.stream()
                .filter(r -> camp.getId().equals(r.getCampaignId())
                        || (r.getCampaignId() == null && camp.getName().equalsIgnoreCase(r.getCampaignTag())))
                .toList();

        List<CampaignCreator> rawAssignments = campaignCreatorRepository.findByCampaignIdOrderByAssignedAtDesc(camp.getId()).stream()
                .filter(a -> creatorMap.containsKey(a.getCreatorId()))
                .toList();

        Map<UUID, CampaignCreator> assignmentByCreator = new LinkedHashMap<>();
        for (CampaignCreator a : rawAssignments) {
            assignmentByCreator.put(a.getCreatorId(), a);
        }

        Set<UUID> rosterIds = new LinkedHashSet<>(assignmentByCreator.keySet());
        for (ReelDeliverable r : campReels) {
            if (r.getCreatorId() != null && creatorMap.containsKey(r.getCreatorId())) {
                rosterIds.add(r.getCreatorId());
            }
        }

        Map<UUID, List<ReelDeliverable>> reelsByCreator = new HashMap<>();
        for (ReelDeliverable r : campReels) {
            reelsByCreator.computeIfAbsent(r.getCreatorId(), k -> new ArrayList<>()).add(r);
        }

        List<Map<String, Object>> assignedCreators = new ArrayList<>();
        int postedCreatorsCount = 0;
        int expectedReelsTotal = 0;
        for (UUID cid : rosterIds) {
            Creator c = creatorMap.get(cid);
            if (c == null) continue;
            CampaignCreator cc = assignmentByCreator.get(cid);
            List<ReelDeliverable> cReels = reelsByCreator.getOrDefault(cid, List.of());
            if (!cReels.isEmpty()) postedCreatorsCount++;
            int expected = cc != null ? cc.getExpectedReels() : Math.max(1, cReels.size());
            expectedReelsTotal += expected;

            long views = cReels.stream().mapToLong(ReelDeliverable::getViewsCount).sum();
            long likes = cReels.stream().mapToLong(ReelDeliverable::getLikesCount).sum();
            long comments = cReels.stream().mapToLong(ReelDeliverable::getCommentsCount).sum();

            double cSpend = brandService.computeCampaignSpend(
                    Set.of(cid),
                    cc != null ? Map.of(cid, cc) : Map.of(),
                    creatorMap,
                    cReels,
                    totalReelsByCreator
            );

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("assignment", cc);
            entry.put("creator", c);
            entry.put("reelsCount", cReels.size());
            entry.put("expectedReels", expected);
            entry.put("viewsCount", views);
            entry.put("likesCount", likes);
            entry.put("commentsCount", comments);
            entry.put("calculatedSpend", cSpend > 0 ? Math.round(cSpend) : null);
            entry.put("status", !cReels.isEmpty() ? "POSTED" : "PENDING_POST");
            assignedCreators.add(entry);
        }

        long viewsDelivered = campReels.stream().mapToLong(ReelDeliverable::getViewsCount).sum();
        long interactions = campReels.stream().mapToLong(r -> r.getLikesCount() + r.getCommentsCount()).sum();
        double totalSpend = brandService.computeCampaignSpend(
                rosterIds, assignmentByCreator, creatorMap, campReels, totalReelsByCreator);
        Double blendedCpv = (totalSpend > 0 && viewsDelivered > 0) ? Math.round((totalSpend / viewsDelivered) * 100.0) / 100.0 : null;
        Double blendedCpe = (totalSpend > 0 && interactions > 0) ? Math.round((totalSpend / interactions) * 100.0) / 100.0 : null;
        double engRate = (viewsDelivered > 0 && interactions > 0) ? Math.round((interactions * 100.0 / viewsDelivered) * 100.0) / 100.0 : 0.0;

        Double budgetRemaining = (camp.getBudgetAmount() != null && camp.getBudgetAmount() > 0)
                ? Math.round((camp.getBudgetAmount() - totalSpend) * 100.0) / 100.0
                : null;
        Double budgetUtilPct = (camp.getBudgetAmount() != null && camp.getBudgetAmount() > 0)
                ? Math.round((totalSpend * 1000.0 / camp.getBudgetAmount())) / 10.0
                : null;
        Double goalPct = (camp.getTargetViewsGoal() != null && camp.getTargetViewsGoal() > 0)
                ? Math.round((viewsDelivered * 1000.0 / camp.getTargetViewsGoal())) / 10.0
                : null;

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("viewsDelivered", viewsDelivered);
        stats.put("totalInteractions", interactions);
        stats.put("totalSpend", Math.round(totalSpend));
        stats.put("budgetRemaining", budgetRemaining);
        stats.put("budgetUtilizationPct", budgetUtilPct);
        stats.put("goalProgressPct", goalPct);
        stats.put("blendedCpv", blendedCpv);
        stats.put("blendedCpe", blendedCpe);
        stats.put("engagementRate", engRate);
        stats.put("assignedCreatorsCount", assignedCreators.size());
        stats.put("postedCreatorsCount", postedCreatorsCount);
        stats.put("expectedReelsCount", expectedReelsTotal);
        stats.put("deliverablesCount", campReels.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("campaign", camp);
        result.put("brand", Map.of(
                "id", brand.getId(),
                "name", scopedAgency.map(Agency::getName).orElse(brand.getName()),
                "currency", brand.getCurrency()
        ));
        result.put("assignedCreators", assignedCreators);
        result.put("deliverables", campReels);
        result.put("reelDeltas", brandService.buildBrandReelDeltasMap(brand.getId(), campReels));
        result.put("stats", stats);
        return result;
    }

    @Transactional
    public CampaignCreator assignCreatorToCampaign(UUID campaignId, Map<String, Object> payload, Authentication auth) {
        Campaign camp = getCampaignEntity(campaignId);
        Brand brand = brandService.requireBrandAccess(camp.getBrandId(), auth);
        Optional<Agency> scopedAgency = brandService.resolveScopedAgencyForCaller(brand, auth);
        if (scopedAgency.isPresent() && "DRAFT".equalsIgnoreCase(camp.getStatus())) {
            throw new AccessDeniedException("Cannot assign creators to a draft campaign.");
        }

        if (payload == null || brandService.strVal(payload.get("creatorId")).isEmpty()) {
            throw new IllegalArgumentException("Select a creator to assign.");
        }
        UUID creatorId;
        try {
            creatorId = UUID.fromString(brandService.strVal(payload.get("creatorId")));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid creator selection.");
        }

        Creator creator = brandService.requireCreatorManagementAccess(creatorId, auth);
        if (!camp.getBrandId().equals(creator.getBrandId())) {
            throw new AccessDeniedException("Creator does not belong to this workspace.");
        }

        Double agreedCost = payload.get("agreedCost") != null && !brandService.strVal(payload.get("agreedCost")).isEmpty()
                ? brandService.parseNullablePositiveDouble(payload.get("agreedCost"))
                : null;
        int expectedReels = 1;
        if (payload.get("expectedReels") != null && !brandService.strVal(payload.get("expectedReels")).isEmpty()) {
            try {
                expectedReels = Math.max(1, Math.min(50, Integer.parseInt(brandService.strVal(payload.get("expectedReels")))));
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("Expected reels must be a valid whole number.");
            }
        }
        String notes = BrandService.trimToMax(brandService.strVal(payload.get("notes")), 300);

        CampaignCreator link = campaignCreatorRepository.findByCampaignIdAndCreatorId(campaignId, creatorId)
                .orElseGet(() -> {
                    CampaignCreator cc = new CampaignCreator();
                    cc.setCampaignId(campaignId);
                    cc.setBrandId(camp.getBrandId());
                    cc.setCreatorId(creatorId);
                    cc.setDemoData(creator.isDemoData() || camp.isDemoData());
                    return cc;
                });
        link.setAgreedCost(agreedCost);
        link.setExpectedReels(expectedReels);
        link.setNotes(notes);
        CampaignCreator saved = campaignCreatorRepository.save(link);

        String actor = brandService.resolveActor(auth, scopedAgency.isPresent() ? "Agency Manager" : "Brand Manager");
        brandService.recordAudit(camp.getBrandId(), creator.getAgencyId(), "CREATOR_LINK",
                "Creator Assigned to Campaign", "Assigned",
                "Assigned " + creator.getHandle() + " to campaign \"" + camp.getName() + "\".",
                actor, "Campaigns");
        return saved;
    }

    @Transactional
    public void removeCreatorFromCampaign(UUID campaignId, UUID creatorId, Authentication auth) {
        Campaign camp = getCampaignEntity(campaignId);
        brandService.requireBrandAccess(camp.getBrandId(), auth);
        Creator creator = brandService.requireCreatorManagementAccess(creatorId, auth);
        if (!camp.getBrandId().equals(creator.getBrandId())) {
            throw new AccessDeniedException("Creator does not belong to this workspace.");
        }
        campaignCreatorRepository.findByCampaignIdAndCreatorId(campaignId, creatorId)
                .ifPresent(campaignCreatorRepository::delete);

        String actor = brandService.resolveActor(auth, "Workspace Manager");
        brandService.recordAudit(camp.getBrandId(), creator.getAgencyId(), "CREATOR_LINK",
                "Creator Removed from Campaign", "Updated",
                "Removed " + creator.getHandle() + " assignment from campaign \"" + camp.getName() + "\".",
                actor, "Campaigns");
    }

    private Campaign getCampaignEntity(UUID campaignId) {
        return campaignRepository.findById(campaignId)
                .orElseThrow(() -> new IllegalArgumentException("Campaign not found."));
    }

    private static String normalizeCampaignStatus(String raw) {
        if (raw == null || raw.isBlank()) return "ACTIVE";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!VALID_CAMPAIGN_STATUSES.contains(upper)) {
            throw new IllegalArgumentException("Invalid campaign status. Allowed values: ACTIVE, PLANNING, COMPLETED, DRAFT.");
        }
        return upper;
    }

    private Long parseOptionalTargetGoal(Object raw) {
        if (raw == null || String.valueOf(raw).isBlank()) return null;
        try {
            long parsed = Long.parseLong(String.valueOf(raw).replaceAll("[,\\s]", "").trim());
            if (parsed < 0) throw new IllegalArgumentException("Target views goal cannot be negative.");
            return parsed == 0L ? null : parsed;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Target views goal must be a valid whole number.");
        }
    }

    private LocalDate parseOptionalDate(Object raw, String label) {
        if (raw == null || String.valueOf(raw).isBlank()) return null;
        try {
            return LocalDate.parse(String.valueOf(raw).trim());
        } catch (Exception ex) {
            throw new IllegalArgumentException(label + " must be in YYYY-MM-DD format.");
        }
    }
}
