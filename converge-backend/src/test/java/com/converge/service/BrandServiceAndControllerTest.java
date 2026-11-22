package com.converge.service;

import com.converge.controller.BrandController;
import com.converge.entity.Agency;
import com.converge.entity.Brand;
import com.converge.entity.Creator;
import com.converge.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.TestingAuthenticationToken;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BrandServiceAndControllerTest {

    @Mock private BrandRepository brandRepository;
    @Mock private AgencyRepository agencyRepository;
    @Mock private CreatorRepository creatorRepository;
    @Mock private ReelDeliverableRepository reelRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;
    @Mock private InstagramGraphService instagramGraphService;

    private BrandService brandService;
    private BrandController brandController;

    @BeforeEach
    void setUp() {
        brandService = new BrandService(
                brandRepository, agencyRepository, creatorRepository,
                reelRepository, auditLogRepository, userRepository, emailService,
                instagramGraphService, "sysadmin@converge.test"
        );
        brandController = new BrandController(brandService);
    }

    @Test
    void provisionBrandRejectsSystemAdminEmail() {
        assertThrows(IllegalArgumentException.class, () ->
                brandService.provisionBrand(Map.of(
                        "name", "Test Brand",
                        "managerName", "Admin",
                        "managerEmail", "sysadmin@converge.test",
                        "contactNumber", "+91 9876543210"
                ))
        );

        var adminUser = new com.converge.entity.User();
        adminUser.setEmail("anotheradmin@converge.test");
        adminUser.setRole("SYSTEM_ADMIN");
        when(userRepository.findByEmailIgnoreCase("anotheradmin@converge.test")).thenReturn(Optional.of(adminUser));

        assertThrows(IllegalArgumentException.class, () ->
                brandService.provisionBrand(Map.of(
                        "name", "Test Brand",
                        "managerName", "Admin",
                        "managerEmail", "anotheradmin@converge.test",
                        "contactNumber", "+91 9876543210"
                ))
        );
    }

    @Test
    void provisionBrandValidatesEmailPhoneAndHandle() {
        assertThrows(IllegalArgumentException.class, () ->
                brandService.provisionBrand(Map.of(
                        "name", "Bioderma",
                        "managerName", "Aman",
                        "managerEmail", "cha",
                        "contactNumber", "+91 9876543210"
                ))
        );

        assertThrows(IllegalArgumentException.class, () ->
                brandService.provisionBrand(Map.of(
                        "name", "Bioderma",
                        "managerName", "Aman",
                        "managerEmail", "aman@example.com",
                        "contactNumber", "+91 123"
                ))
        );

        assertThrows(IllegalArgumentException.class, () ->
                brandService.provisionBrand(Map.of(
                        "name", "Bioderma",
                        "managerName", "Aman",
                        "managerEmail", "aman@example.com",
                        "contactNumber", "+91 9876543210",
                        "instagramHandle", "@bad handle"
                ))
        );
    }

    @Test
    void provisionBrandSavesValidPayload() {
        when(userRepository.findByEmailIgnoreCase("aman@example.com")).thenReturn(Optional.empty());
        when(brandRepository.save(any(Brand.class))).thenAnswer(inv -> {
            Brand b = inv.getArgument(0);
            b.setId(UUID.randomUUID());
            return b;
        });

        Brand saved = brandService.provisionBrand(Map.of(
                "name", "Bioderma India",
                "managerName", "Aman Gulabani",
                "managerEmail", "aman@example.com",
                "contactNumber", "+91 98765 43210",
                "instagramHandle", "@bioderma_in"
        ));

        assertEquals("Bioderma India", saved.getName());
        assertEquals("ACTIVE", saved.getStatus());
        assertNotNull(saved.getActivationToken());
        assertFalse(saved.getActivationToken().isBlank());
        assertEquals("+91 98765 43210", saved.getContactNumber());
        verify(emailService).sendBrandWelcomeEmail(
                eq("aman@example.com"),
                eq("Aman Gulabani"),
                eq("Bioderma India"),
                argThat(rawToken -> rawToken != null && !rawToken.isBlank() && !rawToken.equals(saved.getActivationToken()))
        );
    }

    @Test
    void provisionBrandRejectsDuplicateBrandNameCaseInsensitive() {
        var existing = new Brand();
        existing.setId(UUID.randomUUID());
        existing.setName("Bioderma");
        when(brandRepository.findAllByNameIgnoreCase("bioderma")).thenReturn(List.of(existing));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                brandService.provisionBrand(Map.of(
                        "name", "bioderma",
                        "managerName", "Other Manager",
                        "managerEmail", "other@example.com",
                        "contactNumber", "+91 9876543210"
                ))
        );
        assertTrue(ex.getMessage().contains("already exists"));
        verify(brandRepository, never()).save(any());
    }

    @Test
    void updateBrandUpdatesManagerDetailsAndRejectsDuplicateName() {
        UUID brandId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        var existing = new Brand();
        existing.setId(brandId);
        existing.setName("Bioderma");
        existing.setManagerName("Aman");
        existing.setManagerEmail("aman@example.com");

        var conflictingBrand = new Brand();
        conflictingBrand.setId(otherId);
        conflictingBrand.setName("OZiva");

        when(brandRepository.findById(brandId)).thenReturn(Optional.of(existing));
        when(brandRepository.findAllByNameIgnoreCase("OZiva")).thenReturn(List.of(conflictingBrand));
        when(brandRepository.findAllByNameIgnoreCase("Bioderma India")).thenReturn(List.of());
        when(userRepository.findByEmailIgnoreCase("newmanager@example.com")).thenReturn(Optional.empty());
        when(brandRepository.save(any(Brand.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThrows(IllegalArgumentException.class, () ->
                brandService.updateBrand(brandId, Map.of("name", "OZiva"))
        );

        Brand updated = brandService.updateBrand(brandId, Map.of(
                "name", "Bioderma India",
                "managerName", "Riya Kapoor",
                "managerEmail", "newmanager@example.com",
                "contactNumber", "+91 9988776655"
        ));
        assertEquals("Bioderma India", updated.getName());
        assertEquals("Riya Kapoor", updated.getManagerName());
        assertEquals("newmanager@example.com", updated.getManagerEmail());
        assertEquals("+91 9988776655", updated.getContactNumber());
    }

    @Test
    void deleteBrandCascadesChildEntities() {
        UUID id = UUID.randomUUID();
        Brand brand = new Brand();
        brand.setId(id);
        when(brandRepository.findById(id)).thenReturn(Optional.of(brand));

        brandService.deleteBrand(id);

        verify(reelRepository).deleteByBrandId(id);
        verify(creatorRepository).deleteByBrandId(id);
        verify(agencyRepository).deleteByBrandId(id);
        verify(auditLogRepository).deleteByBrandId(id);
        verify(brandRepository).delete(brand);
    }

    @Test
    void controllerRestrictsProvisionAndDeleteToSystemAdmin() {
        var nonAdmin = new TestingAuthenticationToken("user@example.com", null, "ROLE_BRAND_MANAGER");
        var admin = new TestingAuthenticationToken("admin@example.com", null, "ROLE_SYSTEM_ADMIN");
        UUID id = UUID.randomUUID();

        assertEquals(HttpStatus.FORBIDDEN, brandController.provision(Map.of(), nonAdmin).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, brandController.delete(id, nonAdmin).getStatusCode());

        Brand brand = new Brand();
        brand.setId(id);
        when(brandRepository.findById(id)).thenReturn(Optional.of(brand));

        assertEquals(HttpStatus.OK, brandController.delete(id, admin).getStatusCode());
    }

    @Test
    void updateCreatorInsightsProfileUpdatesOnlyCrmMetadataAndProtectsIgMetrics() {
        UUID creatorId = UUID.randomUUID();
        UUID brandId = UUID.randomUUID();
        UUID brandId2 = UUID.randomUUID();
        var creator = new com.converge.entity.Creator();
        creator.setId(creatorId);
        creator.setBrandId(brandId);
        creator.setHandle("@jasminbhasin2806");
        creator.setName("Jasmine Bhasin");
        creator.setCategory("Direct / Independent");
        creator.setFollowersCount(587L);
        creator.setFollowersDisplay("587");
        creator.setTotalViews30d(0L);
        creator.setInsightsSource("BUSINESS_DISCOVERY_PARTIAL");

        var siblingLink = new com.converge.entity.Creator();
        siblingLink.setId(UUID.randomUUID());
        siblingLink.setBrandId(brandId2);
        siblingLink.setHandle("@jasminbhasin2806");

        var b1 = new Brand();
        b1.setId(brandId);
        b1.setName("BIODERMA (IN)");
        var b2 = new Brand();
        b2.setId(brandId2);
        b2.setName("OZiva India");

        when(creatorRepository.findById(creatorId)).thenReturn(Optional.of(creator));
        when(creatorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId)).thenReturn(List.of());
        when(creatorRepository.findByHandleIgnoreCase("@jasminbhasin2806")).thenReturn(List.of(creator, siblingLink));
        when(brandRepository.findAllById(any())).thenReturn(List.of(b1, b2));

        InstagramGraphService realHelper = new InstagramGraphService(new com.converge.config.InstagramProperties());
        doAnswer(inv -> { realHelper.evaluateCreatorQualification(inv.getArgument(0)); return null; })
                .when(instagramGraphService).evaluateCreatorQualification(any());
        when(instagramGraphService.buildCreatorInsightsSummary(any(), any(), any()))
                .thenAnswer(inv -> realHelper.buildCreatorInsightsSummary(
                        inv.getArgument(0), inv.getArgument(1), inv.getArgument(2)));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("category", "TamperedCategory");
        payload.put("managementHandle", "stellaartalent");
        payload.put("country", "India");
        payload.put("costMode", "PER_DELIVERABLE");
        payload.put("costQuoted", 100000);
        payload.put("previousBrandPartners", List.of("CHAUPAL Punjabi", "OZiva"));
        payload.put("creatorTraits", List.of("Skincare", "Lifestyle"));
        // Attempted manual tampering with Meta numbers must be ignored:
        payload.put("followersCount", 9999999L);
        payload.put("totalViews30d", 80700000L);
        payload.put("verified", true);

        Map<String, Object> result = brandService.updateCreatorInsightsProfile(creatorId, payload);

        var savedCreator = (com.converge.entity.Creator) result.get("creator");
        assertEquals("Direct / Independent", savedCreator.getCategory()); // non-editable
        assertEquals("@stellaartalent", savedCreator.getManagementHandle());
        assertEquals("India", savedCreator.getCountry());
        assertEquals("PER_DELIVERABLE", savedCreator.getCostMode());
        assertEquals(100000.0, savedCreator.getCostQuoted());
        assertEquals(587L, savedCreator.getFollowersCount());
        assertEquals(0L, savedCreator.getTotalViews30d());
        assertFalse(savedCreator.isVerified());
        assertEquals("BUSINESS_DISCOVERY_PARTIAL", savedCreator.getInsightsSource());
        assertEquals(List.of("BIODERMA (IN)", "OZiva India"), result.get("associatedBrands"));
    }

    @Test
    void computesRoiBenchmarksFromOfficialMetricsAndCostQuoted() {
        var creator = new com.converge.entity.Creator();
        creator.setId(UUID.randomUUID());
        creator.setHandle("@agranisinghh");
        creator.setFollowersCount(14405L);
        creator.setFollowersDisplay("14.4K");
        creator.setCostQuoted(100000.0);

        var deliverable = new com.converge.entity.ReelDeliverable();
        deliverable.setViewsCount(4801L);
        deliverable.setLikesCount(0L);
        deliverable.setCommentsCount(10L);
        deliverable.setSavesCount(99L); // intentionally ignored
        deliverable.setSharesCount(55L); // intentionally ignored

        InstagramGraphService realHelper = new InstagramGraphService(new com.converge.config.InstagramProperties());
        Map<String, Object> bundle = realHelper.buildCreatorInsightsSummary(creator, List.of(deliverable), List.of());

        Map<?, ?> kpis = (Map<?, ?>) bundle.get("kpiSummary");
        assertEquals(4801L, kpis.get("totalViews"));
        assertEquals(0L, kpis.get("totalLikes"));
        assertEquals(10L, kpis.get("totalComments"));
        assertEquals(10L, kpis.get("totalInteractions"));
        assertEquals(1, kpis.get("submittedDeliverables"));

        Map<?, ?> roi = (Map<?, ?>) bundle.get("roiBenchmarks");
        assertEquals("Micro", roi.get("tier"));
        assertEquals(0.07, roi.get("interactionRatePct"));
        assertEquals(4801L, roi.get("avgViewsPerPost"));
        assertEquals(100000.0, roi.get("costQuoted"));
        assertEquals(6942.03, roi.get("costPer1kFollowers"));
        assertEquals(10000.0, roi.get("costPerInteraction"));
        assertEquals(20.83, roi.get("costPerView"));
    }

    @Test
    void updateDeliverableUpdatesTitleAndCostQuoted() {
        UUID creatorId = UUID.randomUUID();
        UUID deliverableId = UUID.randomUUID();
        var reel = new com.converge.entity.ReelDeliverable();
        reel.setId(deliverableId);
        reel.setBrandId(UUID.randomUUID());
        reel.setCreatorId(creatorId);
        reel.setTitle("Old Title");

        var creator = new com.converge.entity.Creator();
        creator.setId(creatorId);
        creator.setBrandId(reel.getBrandId());
        creator.setHandle("@agranisinghh");

        when(reelRepository.findById(deliverableId)).thenReturn(Optional.of(reel));
        when(reelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId)).thenReturn(List.of(reel));
        when(creatorRepository.findById(creatorId)).thenReturn(Optional.of(creator));
        when(creatorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var updated = brandService.updateDeliverable(deliverableId, Map.of("title", "Deliverable #1", "costQuoted", 100000));
        assertEquals("Deliverable #1", updated.getTitle());
        assertEquals(100000.0, updated.getCostQuoted());
    }

    @Test
    void supportsCollectiveAndPerDeliverableCostModes() {
        var creator = new com.converge.entity.Creator();
        creator.setId(UUID.randomUUID());
        creator.setFollowersCount(20000L);
        creator.setFollowersDisplay("20.0K");
        creator.setCostMode("PER_DELIVERABLE");
        creator.setCostQuoted(500000.0); // ignored when PER_DELIVERABLE

        var d1 = new com.converge.entity.ReelDeliverable();
        d1.setViewsCount(10000L);
        d1.setLikesCount(300L);
        d1.setCommentsCount(20L);
        d1.setCostQuoted(60000.0);

        var d2 = new com.converge.entity.ReelDeliverable();
        d2.setViewsCount(10000L);
        d2.setLikesCount(180L);
        d2.setCommentsCount(0L);
        d2.setCostQuoted(40000.0);

        InstagramGraphService realHelper = new InstagramGraphService(new com.converge.config.InstagramProperties());
        Map<String, Object> perDelBundle = realHelper.buildCreatorInsightsSummary(creator, List.of(d1, d2), List.of());
        Map<?, ?> perDelRoi = (Map<?, ?>) perDelBundle.get("roiBenchmarks");
        assertEquals("PER_DELIVERABLE", perDelRoi.get("costMode"));
        assertEquals(2, perDelRoi.get("pricedDeliverablesCount"));
        assertEquals(100000.0, perDelRoi.get("costQuoted"));
        assertEquals(5.0, perDelRoi.get("costPerView")); // 100000 / 20000

        Map<String, Object> d1Summary = realHelper.buildDeliverableInsightsSummary(d1, creator, 2);
        Map<?, ?> d1Derived = (Map<?, ?>) d1Summary.get("derived");
        assertEquals("PER_DELIVERABLE", d1Derived.get("costMode"));
        assertEquals(60000.0, d1Derived.get("costQuoted"));
        assertEquals(6.0, d1Derived.get("costPerView"));

        // Switch to COLLECTIVE: uses creator.costQuoted (500000) and allocates evenly per reel
        creator.setCostMode("COLLECTIVE");
        Map<String, Object> colBundle = realHelper.buildCreatorInsightsSummary(creator, List.of(d1, d2), List.of());
        Map<?, ?> colRoi = (Map<?, ?>) colBundle.get("roiBenchmarks");
        assertEquals("COLLECTIVE", colRoi.get("costMode"));
        assertEquals(500000.0, colRoi.get("costQuoted"));
        assertEquals(25.0, colRoi.get("costPerView")); // 500000 / 20000

        Map<String, Object> colReelSummary = realHelper.buildDeliverableInsightsSummary(d1, creator, 2);
        Map<?, ?> colDerived = (Map<?, ?>) colReelSummary.get("derived");
        assertEquals("COLLECTIVE", colDerived.get("costMode"));
        assertEquals(250000.0, colDerived.get("costQuoted"));
        assertEquals(25.0, colDerived.get("costPerView"));

        // Per-deliverable mode also applies creator default rate to unpriced deliverables cleanly
        creator.setCostMode("PER_DELIVERABLE");
        creator.setCostQuoted(50000.0);
        var unpriced1 = new com.converge.entity.ReelDeliverable();
        unpriced1.setViewsCount(5000L);
        var unpriced2 = new com.converge.entity.ReelDeliverable();
        unpriced2.setViewsCount(5000L);
        Map<String, Object> fallbackBundle = realHelper.buildCreatorInsightsSummary(creator, List.of(unpriced1, unpriced2), List.of());
        Map<?, ?> fallbackRoi = (Map<?, ?>) fallbackBundle.get("roiBenchmarks");
        assertEquals(100000.0, fallbackRoi.get("costQuoted"));
        assertEquals(10.0, fallbackRoi.get("costPerView")); // 100000 / 10000
    }

    @Test
    void addReelDeliverableRejectsDuplicateShortcodeOrQueryVariant() {
        var creator = new com.converge.entity.Creator();
        creator.setId(UUID.randomUUID());
        creator.setBrandId(UUID.randomUUID());
        creator.setHandle("@rahulsaharan");

        com.converge.entity.ReelDeliverable existing = new com.converge.entity.ReelDeliverable();
        existing.setId(UUID.randomUUID());
        existing.setCreatorId(creator.getId());
        existing.setShortcode("DffQCZBtDfN");
        existing.setReelUrl("https://www.instagram.com/reel/DffQCZBtDfN/");

        when(creatorRepository.findById(creator.getId())).thenReturn(Optional.of(creator));
        when(reelRepository.findByCreatorIdOrderBySyncedAtDesc(creator.getId())).thenReturn(List.of(existing));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> brandService.addReelDeliverable(
                        creator.getId(),
                        Map.of("title", "Duplicate", "reelUrl", "https://www.instagram.com/p/DffQCZBtDfN/?igsh=xyz")
                )
        );
        assertTrue(ex.getMessage().contains("already added"));
        verify(reelRepository, never()).save(any());
    }

    @Test
    void addAgencyValidatesFieldsSupportsDraftAndRejectsDuplicateNames() {
        UUID brandId = UUID.randomUUID();
        Brand brand = new Brand();
        brand.setId(brandId);
        brand.setName("Bioderma India");
        when(brandRepository.findById(brandId)).thenReturn(Optional.of(brand));
        when(agencyRepository.findByBrandIdAndNameIgnoreCase(brandId, "Studio North")).thenReturn(List.of());
        when(agencyRepository.save(any(Agency.class))).thenAnswer(inv -> {
            Agency a = inv.getArgument(0);
            a.setId(UUID.randomUUID());
            return a;
        });

        assertThrows(IllegalArgumentException.class, () ->
                brandService.addAgency(brandId, Map.of(
                        "name", "Studio North",
                        "contactName", "Riya Kapoor",
                        "contactEmail", "invalid-email",
                        "contactNumber", "+91 9876543210"
                ))
        );

        assertThrows(IllegalArgumentException.class, () ->
                brandService.addAgency(brandId, Map.of(
                        "name", "Studio North",
                        "contactName", "Riya Kapoor",
                        "contactEmail", "riya@studionorth.in",
                        "contactNumber", "+91 123"
                ))
        );

        Agency draftAgency = brandService.addAgency(brandId, Map.of(
                "name", "Studio North",
                "contactName", "Riya Kapoor",
                "contactEmail", "Riya@StudioNorth.in",
                "contactNumber", "+91 98765 43210",
                "status", "DRAFT"
        ));

        assertEquals("Studio North", draftAgency.getName());
        assertEquals("Riya Kapoor", draftAgency.getContactName());
        assertEquals("riya@studionorth.in", draftAgency.getContactEmail());
        assertEquals("+91 98765 43210", draftAgency.getContactNumber());
        assertEquals("DRAFT", draftAgency.getStatus());

        when(agencyRepository.findByBrandIdAndNameIgnoreCase(brandId, "Studio North")).thenReturn(List.of(draftAgency));
        assertThrows(IllegalArgumentException.class, () ->
                brandService.addAgency(brandId, Map.of(
                        "name", "Studio North",
                        "contactName", "Another Lead",
                        "contactEmail", "lead@studionorth.in",
                        "contactNumber", "+91 9876543210"
                ))
        );
    }

    @Test
    void updateAndDeleteAgencySyncLinkedCreatorsCleanly() {
        UUID brandId = UUID.randomUUID();
        UUID agencyId = UUID.randomUUID();
        Agency agency = new Agency();
        agency.setId(agencyId);
        agency.setBrandId(brandId);
        agency.setName("Studio North");
        agency.setMonogram("SN");
        agency.setHandle("@studionorth");
        agency.setContactName("Old Manager");
        agency.setContactEmail("old@studionorth.in");
        agency.setContactNumber("+91 9000000000");
        agency.setStatus("DRAFT");

        Creator linkedCreator = new Creator();
        linkedCreator.setId(UUID.randomUUID());
        linkedCreator.setBrandId(brandId);
        linkedCreator.setAgencyId(agencyId);
        linkedCreator.setAgencyName("Studio North");
        linkedCreator.setSourceType("AGENCY");

        when(agencyRepository.findById(agencyId)).thenReturn(Optional.of(agency));
        when(agencyRepository.findByBrandIdAndNameIgnoreCase(brandId, "North Collective")).thenReturn(List.of());
        when(agencyRepository.save(any(Agency.class))).thenAnswer(inv -> inv.getArgument(0));
        when(creatorRepository.findByAgencyId(agencyId)).thenReturn(List.of(linkedCreator));

        Agency updated = brandService.updateAgencyPermissions(brandId, agencyId, Map.of(
                "name", "North Collective",
                "contactName", "Neha Sharma",
                "contactEmail", "Neha@North.in",
                "contactNumber", "+91 9811122233",
                "status", "CONNECTED"
        ));

        assertEquals("North Collective", updated.getName());
        assertEquals("NC", updated.getMonogram());
        assertEquals("Neha Sharma", updated.getContactName());
        assertEquals("neha@north.in", updated.getContactEmail());
        assertEquals("+91 9811122233", updated.getContactNumber());
        assertEquals("CONNECTED", updated.getStatus());
        assertEquals("North Collective", linkedCreator.getAgencyName());

        brandService.deleteAgency(brandId, agencyId, "manager@brand.test");

        assertNull(linkedCreator.getAgencyId());
        assertEquals("Direct / Independent", linkedCreator.getAgencyName());
        assertEquals("DIRECT", linkedCreator.getSourceType());
        verify(creatorRepository, times(2)).saveAll(any());
        verify(agencyRepository).delete(agency);
    }

    @Test
    void syncCreatorPreservesOAuthAccountInsightsInsteadOfClobberingThem() {
        UUID creatorId = UUID.randomUUID();
        UUID brandId = UUID.randomUUID();

        var creator = new com.converge.entity.Creator();
        creator.setId(creatorId);
        creator.setBrandId(brandId);
        creator.setHandle("@oauth_star");
        creator.setFollowersCount(1000000L);
        creator.setTotalViews30d(80000000L);
        creator.setReachCount(42000000L);
        creator.setAccountInteractions30d(2500000L);
        creator.setInteractionRate90d(5.9);
        creator.setInsightsSource("CREATOR_OAUTH_INSIGHTS");

        var trackedReel = new com.converge.entity.ReelDeliverable();
        trackedReel.setId(UUID.randomUUID());
        trackedReel.setBrandId(brandId);
        trackedReel.setCreatorId(creatorId);
        trackedReel.setViewsCount(250000L);
        trackedReel.setLikesCount(5000L);
        trackedReel.setCommentsCount(200L);
        trackedReel.setStatus("VERIFIED");

        when(creatorRepository.findById(creatorId)).thenReturn(Optional.of(creator));
        when(reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId)).thenReturn(List.of(trackedReel));
        when(creatorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(brandRepository.findAllById(any())).thenReturn(List.of());
        InstagramGraphService realHelper = new InstagramGraphService(new com.converge.config.InstagramProperties());
        when(instagramGraphService.buildCreatorInsightsSummary(any(), any(), any()))
                .thenAnswer(inv -> realHelper.buildCreatorInsightsSummary(
                        inv.getArgument(0), inv.getArgument(1), inv.getArgument(2)));

        Map<String, Object> out = brandService.syncCreatorFromInstagram(creatorId, false, "mgr@brand.test", "Mgr");
        var savedCreator = (com.converge.entity.Creator) out.get("creator");

        verify(instagramGraphService).evictCreatorCache("@oauth_star");
        assertEquals(80000000L, savedCreator.getTotalViews30d());
        assertEquals(42000000L, savedCreator.getReachCount());
        assertEquals(2500000L, savedCreator.getAccountInteractions30d());
        assertEquals(5.9, savedCreator.getInteractionRate90d());
        assertEquals(1, savedCreator.getAuditedReelsCount());
    }

    @Test
    void syncDeliverableRecordsSnapshotBaselineAndComputesRealDeltas() {
        ReelSnapshotRepository snapshotRepo = mock(ReelSnapshotRepository.class);
        BrandService serviceWithSnapshots = new BrandService(
                brandRepository, agencyRepository, creatorRepository,
                reelRepository, auditLogRepository, userRepository, emailService,
                instagramGraphService, snapshotRepo, "sysadmin@converge.test"
        );

        UUID brandId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID deliverableId = UUID.randomUUID();

        var creator = new Creator();
        creator.setId(creatorId);
        creator.setBrandId(brandId);
        creator.setHandle("@aman.gulabani");
        creator.setFollowersCount(585L);

        var reel = new com.converge.entity.ReelDeliverable();
        reel.setId(deliverableId);
        reel.setBrandId(brandId);
        reel.setCreatorId(creatorId);
        reel.setViewsCount(2909L);
        reel.setLikesCount(111L);
        reel.setCommentsCount(9L);
        reel.setStatus("VERIFIED");

        List<com.converge.entity.ReelSnapshot> storedSnapshots = new ArrayList<>();
        when(reelRepository.findById(deliverableId)).thenReturn(Optional.of(reel));
        when(creatorRepository.findById(creatorId)).thenReturn(Optional.of(creator));
        when(reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId)).thenReturn(List.of(reel));
        when(reelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(creatorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        when(snapshotRepo.findFirstByDeliverableIdOrderByCapturedAtDesc(deliverableId))
                .thenAnswer(inv -> storedSnapshots.isEmpty()
                        ? Optional.empty()
                        : Optional.of(storedSnapshots.get(storedSnapshots.size() - 1)));
        when(snapshotRepo.save(any())).thenAnswer(inv -> {
            com.converge.entity.ReelSnapshot s = inv.getArgument(0);
            storedSnapshots.add(s);
            return s;
        });
        when(snapshotRepo.findTop14ByDeliverableIdOrderByCapturedAtDesc(deliverableId))
                .thenAnswer(inv -> {
                    List<com.converge.entity.ReelSnapshot> desc = new ArrayList<>(storedSnapshots);
                    Collections.reverse(desc);
                    return desc;
                });

        doAnswer(inv -> {
            com.converge.entity.ReelDeliverable target = inv.getArgument(0);
            target.setViewsCount(3109L);
            target.setLikesCount(121L);
            return null;
        }).when(instagramGraphService).syncReelDeliverable(any(), any());

        serviceWithSnapshots.syncDeliverableFromInstagram(deliverableId);

        assertEquals(2, storedSnapshots.size(), "Pre-sync baseline and updated metric point must both be stored");
        assertEquals(2909L, storedSnapshots.get(0).getViewsCount());
        assertEquals(3109L, storedSnapshots.get(1).getViewsCount());

        InstagramGraphService realHelper = new InstagramGraphService(new com.converge.config.InstagramProperties());
        when(instagramGraphService.buildDeliverableInsightsSummary(any(), any(), anyInt()))
                .thenAnswer(inv -> realHelper.buildDeliverableInsightsSummary(
                        inv.getArgument(0), inv.getArgument(1), inv.getArgument(2)));

        Map<String, Object> insights = serviceWithSnapshots.getDeliverableInsights(deliverableId);
        @SuppressWarnings("unchecked")
        Map<String, Object> derived = (Map<String, Object>) insights.get("derived");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> snapshots = (List<Map<String, Object>>) insights.get("snapshots");

        assertEquals(200L, ((Number) derived.get("viewsDeltaLastSync")).longValue());
        assertEquals(10L, ((Number) derived.get("likesDeltaLastSync")).longValue());
        assertEquals(2, snapshots.size());
        assertEquals(200L, ((Number) snapshots.get(1).get("deltaViews")).longValue());
    }

    @Test
    void scheduledAndLoginSyncFetchLatestViewsAndRespectCooldownWhileManualAlwaysRuns() {
        UUID brandId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID deliverableId = UUID.randomUUID();

        Brand brand = new Brand();
        brand.setId(brandId);
        brand.setName("Aura");
        brand.setStatus("ACTIVE");
        brand.setManagerEmail("brand@aura.test");

        com.converge.entity.Creator creator = new com.converge.entity.Creator();
        creator.setId(creatorId);
        creator.setBrandId(brandId);
        creator.setName("Aman");
        creator.setHandle("@aman.gulabani");
        creator.setSourceType("DIRECT");

        com.converge.entity.ReelDeliverable reel = new com.converge.entity.ReelDeliverable();
        reel.setId(deliverableId);
        reel.setBrandId(brandId);
        reel.setCreatorId(creatorId);
        reel.setViewsCount(1000L);
        reel.setStatus("VERIFIED");

        when(brandRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(brand));
        when(brandRepository.findById(brandId)).thenReturn(Optional.of(brand));
        when(creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId)).thenReturn(List.of(creator));
        when(reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId)).thenReturn(List.of(reel));
        when(reelRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(creatorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(brandRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(instagramGraphService.isBusinessDiscoveryConfigured()).thenReturn(true);

        doAnswer(inv -> {
            com.converge.entity.ReelDeliverable target = inv.getArgument(0);
            target.setViewsCount(target.getViewsCount() + 500L);
            return null;
        }).when(instagramGraphService).syncReelDeliverable(any(), any());

        int syncedBrands = brandService.runScheduledInstagramSync();
        assertEquals(1, syncedBrands);
        assertEquals(1500L, reel.getViewsCount());

        // Immediate follow-up login auto-sync within 60s cooldown returns RECENTLY_SYNCED without re-hitting Meta
        Map<String, Object> loginRes = brandService.syncBrandDeliverablesOnLogin(brandId, "Login Auto-Sync", null);
        assertEquals("RECENTLY_SYNCED", loginRes.get("status"));
        assertEquals(1500L, reel.getViewsCount());

        // Manual sync still forces an immediate refresh even during auto-sync cooldown
        Map<String, Object> manualRes = brandService.syncBrandDeliverables(brandId, "Manual Refresh", null);
        assertEquals("SYNCED", manualRes.get("status"));
        assertEquals(2000L, reel.getViewsCount());
    }
}
