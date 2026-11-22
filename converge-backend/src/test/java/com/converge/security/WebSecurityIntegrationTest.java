package com.converge.security;

import com.converge.entity.Brand;
import com.converge.entity.Creator;
import com.converge.entity.User;
import com.converge.repository.AgencyRepository;
import com.converge.repository.BrandRepository;
import com.converge.repository.CreatorRepository;
import com.converge.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:converge_sec_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "app.jwt.secret=integration-test-jwt-secret-key-with-at-least-64-bytes-for-hs256-signing",
        "app.admin.email=secadmin@converge.test",
        "app.admin.password-hash=$2a$10$7EqJtq98hPqEX7fNZaFWoOHi7f7nB0rK7j8C5mE7zK0c7B5J6qW2K",
        "app.google.client-id=test-google-client-id"
})
@AutoConfigureMockMvc
class WebSecurityIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtService jwtService;
    @Autowired private UserRepository userRepository;
    @Autowired private BrandRepository brandRepository;
    @Autowired private AgencyRepository agencyRepository;
    @Autowired private CreatorRepository creatorRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Autowired private com.converge.repository.CampaignRepository campaignRepository;
    @Autowired private com.converge.repository.CampaignCreatorRepository campaignCreatorRepository;
    @Autowired private com.converge.repository.ReelDeliverableRepository reelRepository;

    private User adminUser;
    private User managerA;
    private User managerB;
    private Brand brandA;
    private Creator creatorA;

    @BeforeEach
    void initData() {
        campaignCreatorRepository.deleteAll();
        campaignRepository.deleteAll();
        reelRepository.deleteAll();
        creatorRepository.deleteAll();
        agencyRepository.deleteAll();
        brandRepository.deleteAll();
        userRepository.deleteAll();

        adminUser = new User();
        adminUser.setName("Admin");
        adminUser.setEmail("secadmin@converge.test");
        adminUser.setRole("SYSTEM_ADMIN");
        adminUser.setVerified(true);
        adminUser.setPasswordHash(passwordEncoder.encode("StrongAdminPass1!"));
        adminUser = userRepository.save(adminUser);

        managerA = new User();
        managerA.setName("Manager A");
        managerA.setEmail("mgra@converge.test");
        managerA.setRole("BRAND_MANAGER");
        managerA.setVerified(true);
        managerA.setPasswordHash(passwordEncoder.encode("ManagerPassA1!"));
        managerA = userRepository.save(managerA);

        managerB = new User();
        managerB.setName("Manager B");
        managerB.setEmail("mgrb@converge.test");
        managerB.setRole("BRAND_MANAGER");
        managerB.setVerified(true);
        managerB.setPasswordHash(passwordEncoder.encode("ManagerPassB1!"));
        managerB = userRepository.save(managerB);

        brandA = new Brand();
        brandA.setName("Brand Alpha " + UUID.randomUUID().toString().substring(0, 6));
        brandA.setCode("BRD-" + Math.abs(UUID.randomUUID().hashCode() % 89999 + 10000));
        brandA.setSlug("@brandalpha");
        brandA.setManagerEmail("mgra@converge.test");
        brandA.setManagerId(managerA.getId());
        brandA.setActivationToken("hashed-secret-token");
        brandA = brandRepository.save(brandA);

        creatorA = new Creator();
        creatorA.setBrandId(brandA.getId());
        creatorA.setName("Creator A");
        creatorA.setHandle("@creator_a");
        creatorRepository.save(creatorA);
        creatorA = creatorRepository.findByBrandIdAndHandleIgnoreCase(brandA.getId(), "@creator_a").orElseThrow();
    }

    @Test
    void enforcesAuthTenantIsolationAndDenyByDefault() throws Exception {
        String tokenA = jwtService.generateToken(managerA);
        String tokenB = jwtService.generateToken(managerB);
        String tokenAdmin = jwtService.generateToken(adminUser);

        // Unauthenticated API calls return 401
        mockMvc.perform(get("/api/brands"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Authentication required."));

        // Unknown non-API path denied by default
        mockMvc.perform(get("/actuator/env"))
                .andExpect(status().isUnauthorized());

        // Ig OAuth state token cannot authenticate API calls as a Bearer token
        String oauthStateJwt = jwtService.generateInstagramOAuthState(creatorA.getId(), managerA.getEmail());
        mockMvc.perform(get("/api/brands")
                        .header("Authorization", "Bearer " + oauthStateJwt))
                .andExpect(status().isUnauthorized());

        // Manager A can read Brand A and activationToken is never serialized
        mockMvc.perform(get("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("hashed-secret-token"))));

        // Cross-tenant access by Manager B returns 403 across Brand, Creator, Export, and IG endpoints
        mockMvc.perform(get("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/brands/{id}/export", brandA.getId())
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/creators/{id}/insights", creatorA.getId())
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/instagram/oauth/authorize-url")
                        .param("state", creatorA.getId().toString())
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());

        // Manager A cannot patch brand manager details or search users directory
        mockMvc.perform(patch("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"managerEmail\":\"attacker@evil.com\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/users/search").param("email", "mgr")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());

        // System Admin can search users and patch brand
        mockMvc.perform(get("/api/users/search").param("email", "mgr")
                        .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("mgra@converge.test")));

        // Unsigned raw UUID in Instagram OAuth callback is rejected
        mockMvc.perform(post("/api/instagram/oauth/callback")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"fake-code\",\"creatorId\":\"" + creatorA.getId() + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void corsAllowsExactFrontendOriginAndRejectsWildcardTenants() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                        .header("Origin", "https://converge-etp.pages.dev")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://converge-etp.pages.dev"));

        mockMvc.perform(options("/api/auth/login")
                        .header("Origin", "https://evil-attacker.pages.dev")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void nullJsonFieldsInAuthReturnClean400InsteadOf500() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":null,\"password\":null}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void brandManagerCanOnboardViewEditAndDeleteAgencyWhileCrossTenantIsForbidden() throws Exception {
        String tokenA = jwtService.generateToken(managerA);
        String tokenB = jwtService.generateToken(managerB);

        var createResult = mockMvc.perform(post("/api/brands/{id}/agencies", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Studio North\",\"contactName\":\"Riya Kapoor\",\"contactEmail\":\"riya@studionorth.in\",\"contactNumber\":\"+91 9876543210\",\"status\":\"DRAFT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Studio North"))
                .andExpect(jsonPath("$.contactName").value("Riya Kapoor"))
                .andExpect(jsonPath("$.contactEmail").value("riya@studionorth.in"))
                .andExpect(jsonPath("$.contactNumber").value("+91 9876543210"))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn();

        String agencyId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();

        // Cross-tenant Manager B is forbidden from creating, editing, or deleting agencies on Brand A
        mockMvc.perform(post("/api/brands/{id}/agencies", brandA.getId())
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Evil Agency\",\"contactName\":\"Evil Lead\",\"contactEmail\":\"evil@agency.com\",\"contactNumber\":\"+91 9876543210\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/brands/{id}/agencies/{agencyId}", brandA.getId(), agencyId)
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Hacked\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/brands/{id}/agencies/{agencyId}", brandA.getId(), agencyId)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());

        // While agency is in DRAFT, agency manager does not get premature workspace access
        User draftAgencyUser = new User();
        draftAgencyUser.setName("Riya Kapoor");
        draftAgencyUser.setEmail("riya@studionorth.in");
        draftAgencyUser.setRole("BRAND_MANAGER");
        draftAgencyUser.setVerified(false);
        draftAgencyUser.setPasswordHash(passwordEncoder.encode("AgencyPass1!"));
        draftAgencyUser = userRepository.save(draftAgencyUser);
        String draftAgencyToken = jwtService.generateToken(draftAgencyUser);

        mockMvc.perform(get("/api/brands")
                        .header("Authorization", "Bearer " + draftAgencyToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + draftAgencyToken))
                .andExpect(status().isForbidden());

        // Brand Manager A can edit agency details & activate draft, and view them in brand overview
        mockMvc.perform(patch("/api/brands/{id}/agencies/{agencyId}", brandA.getId(), agencyId)
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"North Collective\",\"contactName\":\"Neha Sharma\",\"contactEmail\":\"neha@north.in\",\"contactNumber\":\"+91 9811122233\",\"status\":\"CONNECTED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("North Collective"))
                .andExpect(jsonPath("$.contactName").value("Neha Sharma"))
                .andExpect(jsonPath("$.contactEmail").value("neha@north.in"))
                .andExpect(jsonPath("$.contactNumber").value("+91 9811122233"))
                .andExpect(jsonPath("$.status").value("CONNECTED"));

        // Connected Agency Manager (neha@north.in) can now see Brand A in /api/brands, view overview, and add agency-attributed creators
        User activeAgencyUser = new User();
        activeAgencyUser.setName("Neha Sharma");
        activeAgencyUser.setEmail("neha@north.in");
        activeAgencyUser.setRole("BRAND_MANAGER");
        activeAgencyUser.setVerified(true);
        activeAgencyUser.setPasswordHash(passwordEncoder.encode("AgencyPass2!"));
        activeAgencyUser = userRepository.save(activeAgencyUser);
        String activeAgencyToken = jwtService.generateToken(activeAgencyUser);

        mockMvc.perform(get("/api/brands")
                        .header("Authorization", "Bearer " + activeAgencyToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(brandA.getId().toString()));

        // Before adding any creators for North Collective, agency sees 0 creators (does NOT see Brand A's direct creator @creator_a)
        mockMvc.perform(get("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + activeAgencyToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.creators.length()").value(0))
                .andExpect(content().string(not(containsString("@creator_a"))));

        mockMvc.perform(get("/api/creators/{id}/insights", creatorA.getId())
                        .header("Authorization", "Bearer " + activeAgencyToken))
                .andExpect(status().isForbidden());

        var agencyCreatorResult = mockMvc.perform(post("/api/brands/{id}/creators", brandA.getId())
                        .header("Authorization", "Bearer " + activeAgencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Agency Creator\",\"handle\":\"@agency_star\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceType").value("AGENCY"))
                .andExpect(jsonPath("$.agencyName").value("North Collective"))
                .andReturn();
        String agencyCreatorId = objectMapper.readTree(agencyCreatorResult.getResponse().getContentAsString())
                .get("id").asText();

        // Agency Manager CAN add, edit, sync deliverables and update/sync their agency creator
        var deliverableResult = mockMvc.perform(post("/api/creators/{creatorId}/deliverables", agencyCreatorId)
                        .header("Authorization", "Bearer " + activeAgencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Agency Reel 1\",\"reelUrl\":\"https://www.instagram.com/reel/C8xK2pLm123/\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Agency Reel 1"))
                .andReturn();
        String agencyDeliverableId = objectMapper.readTree(deliverableResult.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(put("/api/creators/deliverables/{deliverableId}", agencyDeliverableId)
                        .header("Authorization", "Bearer " + activeAgencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Agency Reel 1 Edited\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Agency Reel 1 Edited"));

        mockMvc.perform(post("/api/instagram/deliverables/{deliverableId}/sync", agencyDeliverableId)
                        .header("Authorization", "Bearer " + activeAgencyToken))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/creators/{creatorId}/insights-profile", agencyCreatorId)
                        .header("Authorization", "Bearer " + activeAgencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"campaignName\":\"Summer Drop\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/creators/{creatorId}/sync-instagram", agencyCreatorId)
                        .header("Authorization", "Bearer " + activeAgencyToken))
                .andExpect(status().isOk());

        // Brand Manager A has VIEW & DELETE ONLY for agency-added creators and their deliverables
        mockMvc.perform(get("/api/creators/{creatorId}/insights", agencyCreatorId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/creators/{creatorId}/deliverables", agencyCreatorId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/creators/deliverables/{deliverableId}/insights", agencyDeliverableId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/creators/{creatorId}/deliverables", agencyCreatorId)
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Brand Hijack Reel\",\"reelUrl\":\"https://www.instagram.com/reel/C8xK2pLm999/\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/creators/deliverables/{deliverableId}", agencyDeliverableId)
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Brand Edit\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/instagram/deliverables/{deliverableId}/sync", agencyDeliverableId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/creators/{creatorId}/insights-profile", agencyCreatorId)
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"campaignName\":\"Brand Edit\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/creators/{creatorId}/sync-instagram", agencyCreatorId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/instagram/creators/{creatorId}/sync", agencyCreatorId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());

        // Brand Manager A CAN delete deliverables of an agency-added creator, and still manages DIRECT creators
        mockMvc.perform(delete("/api/creators/deliverables/{deliverableId}", agencyDeliverableId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));
        mockMvc.perform(post("/api/creators/{creatorId}/deliverables", agencyCreatorId)
                        .header("Authorization", "Bearer " + activeAgencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Agency Reel Retained\",\"reelUrl\":\"https://www.instagram.com/reel/AgencyKeep1/\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/creators/{creatorId}/deliverables", creatorA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Direct Brand Reel\",\"reelUrl\":\"https://www.instagram.com/reel/DirectReel1/\"}"))
                .andExpect(status().isOk());
        // Brand-wide sync only syncs Brand's DIRECT creator deliverables (skips Agency-managed deliverables)
        mockMvc.perform(post("/api/brands/{id}/sync", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.syncedCount").value(1));

        // Brand Manager A adds another agency and a direct creator; North Collective must not see those audit logs
        mockMvc.perform(post("/api/brands/{id}/agencies", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"South Media\",\"contactName\":\"Kabir\",\"contactEmail\":\"kabir@south.in\",\"contactNumber\":\"+91 9998887776\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/brands/{id}/creators", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Direct Star\",\"handle\":\"@brand_direct\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/brands/{id}/audit-logs", brandA.getId())
                        .header("Authorization", "Bearer " + activeAgencyToken))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("@agency_star")))
                .andExpect(content().string(not(containsString("South Media"))))
                .andExpect(content().string(not(containsString("@brand_direct"))));

        // Agency now sees only its own creator (@agency_star), while Brand Manager A sees all creators
        mockMvc.perform(get("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + activeAgencyToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.creators.length()").value(1))
                .andExpect(jsonPath("$.creators[0].handle").value("@agency_star"))
                .andExpect(content().string(not(containsString("@creator_a"))))
                .andExpect(content().string(not(containsString("@brand_direct"))));

        // Partner Agency Manager cannot delete or onboard other agencies on the brand
        mockMvc.perform(delete("/api/brands/{id}/agencies/{agencyId}", brandA.getId(), agencyId)
                        .header("Authorization", "Bearer " + activeAgencyToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.creators.length()").value(3))
                .andExpect(content().string(containsString("neha@north.in")))
                .andExpect(content().string(containsString("+91 9811122233")));

        // Brand Manager A can remove agency cleanly
        mockMvc.perform(delete("/api/brands/{id}/agencies/{agencyId}", brandA.getId(), agencyId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));
    }

    @Test
    void enforcesPitchEnhancementsSecurityAndPublicReportScoping() throws Exception {
        String tokenA = jwtService.generateToken(managerA);
        String tokenB = jwtService.generateToken(managerB);

        // Seed Partner Agency on Brand A
        com.converge.entity.Agency ag = new com.converge.entity.Agency();
        ag.setBrandId(brandA.getId());
        ag.setName("Scoped Partner");
        ag.setHandle("@scopedpartner");
        ag.setContactName("Rhea");
        ag.setContactEmail("rhea@scoped.test");
        ag.setStatus("CONNECTED");
        ag = agencyRepository.save(ag);

        User agencyUser = new User();
        agencyUser.setName("Rhea");
        agencyUser.setEmail("rhea@scoped.test");
        agencyUser.setRole("BRAND_MANAGER");
        agencyUser.setVerified(true);
        agencyUser.setPasswordHash(passwordEncoder.encode("AgencyPass1!"));
        agencyUser = userRepository.save(agencyUser);
        String agencyToken = jwtService.generateToken(agencyUser);

        // Partner Agency CANNOT modify Brand A's targetViewsGoal settings
        mockMvc.perform(patch("/api/brands/{id}/settings", brandA.getId())
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetViewsGoal\":5000000}"))
                .andExpect(status().isForbidden());

        // Brand Owner A CAN update targetViewsGoal
        mockMvc.perform(patch("/api/brands/{id}/settings", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetViewsGoal\":3000000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetViewsGoal").value(3000000));

        // Demo campaign load + clear works end-to-end (Brand Manager loads direct demo data; Manager B forbidden)
        mockMvc.perform(post("/api/brands/{id}/demo-campaign", brandA.getId())
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/brands/{id}/demo-campaign", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.creatorsAdded").value(5))
                .andExpect(jsonPath("$.reelsAdded").value(8));

        // Agency loads its own scoped demo creator + creates agency-scoped public report WITHOUT spend
        mockMvc.perform(post("/api/brands/{id}/bulk", brandA.getId())) // unknown path denied by denyAll
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/brands/{id}/deliverables/bulk", brandA.getId())
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"defaultCampaignTag\":\"Agency Drop\",\"items\":[{\"reelUrl\":\"https://www.instagram.com/agency_talent/reel/AgDemo01/\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.addedCount").value(1));

        String agencyShareBody = mockMvc.perform(post("/api/brands/{id}/share-reports", brandA.getId())
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Partner Agency View\",\"campaignFilter\":\"ALL\",\"includeSpend\":false}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        var agencyShareNode = objectMapper.readTree(agencyShareBody);
        String agencyReportToken = agencyShareNode.get("shareToken").asText();
        String agencyReportId = agencyShareNode.get("id").asText();

        // Unauthenticated GET to public report works AND strictly scopes to agency's creator only + hides manager emails!
        mockMvc.perform(get("/api/public/reports/{token}", agencyReportToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.report.title").value("Partner Agency View"))
                .andExpect(jsonPath("$.brand.name").value("Scoped Partner"))
                .andExpect(jsonPath("$.creators.length()").value(1))
                .andExpect(jsonPath("$.creators[0].handle").value("@agency_talent"))
                .andExpect(content().string(not(containsString("@aanya.kapoor_demo"))))
                .andExpect(content().string(not(containsString("mgra@converge.test"))));

        // Brand Owner A can create a campaign-filtered report ("Summer Glow Drop") including spend
        String brandShareBody = mockMvc.perform(post("/api/brands/{id}/share-reports", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"CMO Summer Recap\",\"campaignFilter\":\"Summer Glow Drop\",\"includeSpend\":true}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String brandReportToken = objectMapper.readTree(brandShareBody).get("shareToken").asText();

        mockMvc.perform(get("/api/public/reports/{token}", brandReportToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.report.campaignFilter").value("Summer Glow Drop"))
                .andExpect(jsonPath("$.deliverables.length()").value(5));

        // Revoking the agency report blocks subsequent unauthenticated access
        mockMvc.perform(delete("/api/brands/{id}/share-reports/{reportId}", brandA.getId(), agencyReportId)
                        .header("Authorization", "Bearer " + agencyToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/public/reports/{token}", agencyReportToken))
                .andExpect(status().isBadRequest());

        // Clearing demo data removes only demo items while retaining real creators (creatorA)
        mockMvc.perform(delete("/api/brands/{id}/demo-campaign", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removedCreators").value(5))
                .andExpect(jsonPath("$.removedReels").value(8));

        mockMvc.perform(get("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.creators.length()").value(2)); // creatorA + @agency_talent remain intact!
    }

    @Test
    void enforcesCampaignPermissionsAgencyScopingAndPrePostAssignments() throws Exception {
        String tokenA = jwtService.generateToken(managerA);

        // Connected Partner Agency setup on Brand A
        mockMvc.perform(post("/api/brands/{id}/agencies", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Apex Agency\",\"contactName\":\"Apex Lead\",\"contactEmail\":\"lead@apex.test\",\"status\":\"CONNECTED\"}"))
                .andExpect(status().isOk());

        User agencyUser = new User();
        agencyUser.setName("Apex Lead");
        agencyUser.setEmail("lead@apex.test");
        agencyUser.setRole("BRAND_MANAGER");
        agencyUser.setVerified(true);
        agencyUser.setPasswordHash(passwordEncoder.encode("AgencyPass9!"));
        agencyUser = userRepository.save(agencyUser);
        String agencyToken = jwtService.generateToken(agencyUser);

        var agencyCreatorRes = mockMvc.perform(post("/api/brands/{id}/creators", brandA.getId())
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Apex Talent\",\"handle\":\"@apex_creator\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String agencyCreatorId = objectMapper.readTree(agencyCreatorRes.getResponse().getContentAsString())
                .get("id").asText();

        // Option A: Brand Manager creates ACTIVE and DRAFT campaigns; Partner Agency is forbidden from campaign CRUD
        var activeCampRes = mockMvc.perform(post("/api/brands/{id}/campaigns", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Summer Hydration\",\"status\":\"ACTIVE\",\"budgetAmount\":100000,\"targetViewsGoal\":500000,\"startDate\":\"2026-06-01\",\"endDate\":\"2026-06-30\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.campaign.name").value("Summer Hydration"))
                .andExpect(jsonPath("$.campaign.status").value("ACTIVE"))
                .andReturn();
        String activeCampId = objectMapper.readTree(activeCampRes.getResponse().getContentAsString())
                .get("campaign").get("id").asText();

        var draftCampRes = mockMvc.perform(post("/api/brands/{id}/campaigns", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Secret Q4 Launch\",\"status\":\"DRAFT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.campaign.status").value("DRAFT"))
                .andReturn();
        String draftCampId = objectMapper.readTree(draftCampRes.getResponse().getContentAsString())
                .get("campaign").get("id").asText();

        mockMvc.perform(post("/api/brands/{id}/campaigns", brandA.getId())
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Rogue Agency Campaign\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/campaigns/{cid}", activeCampId)
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Hijacked\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/campaigns/{cid}", activeCampId)
                        .header("Authorization", "Bearer " + agencyToken))
                .andExpect(status().isForbidden());

        // Agency can list non-DRAFT campaigns and cannot open DRAFT campaign detail
        mockMvc.perform(get("/api/brands/{id}/campaigns", brandA.getId())
                        .header("Authorization", "Bearer " + agencyToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Summer Hydration"));
        mockMvc.perform(get("/api/campaigns/{cid}", draftCampId)
                        .header("Authorization", "Bearer " + agencyToken))
                .andExpect(status().isForbidden());

        // Pre-post assignments enforce creator ownership isolation
        mockMvc.perform(post("/api/campaigns/{cid}/creators", activeCampId)
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"creatorId\":\"" + creatorA.getId() + "\",\"agreedCost\":25000,\"expectedReels\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expectedReels").value(2));

        mockMvc.perform(post("/api/campaigns/{cid}/creators", activeCampId)
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"creatorId\":\"" + agencyCreatorId + "\",\"agreedCost\":15000}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/campaigns/{cid}/creators", activeCampId)
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"creatorId\":\"" + creatorA.getId() + "\",\"agreedCost\":10000}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/campaigns/{cid}/creators", draftCampId)
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"creatorId\":\"" + agencyCreatorId + "\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/campaigns/{cid}/creators", activeCampId)
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"creatorId\":\"" + agencyCreatorId + "\",\"agreedCost\":15000,\"expectedReels\":1,\"notes\":\"Product unboxing\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.agreedCost").value(15000.0));

        // Before posting reels, status is PENDING_POST and agency sees only its own creator/spend
        mockMvc.perform(get("/api/campaigns/{cid}", activeCampId)
                        .header("Authorization", "Bearer " + agencyToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedCreators.length()").value(1))
                .andExpect(jsonPath("$.assignedCreators[0].creator.handle").value("@apex_creator"))
                .andExpect(jsonPath("$.assignedCreators[0].status").value("PENDING_POST"))
                .andExpect(jsonPath("$.stats.totalSpend").value(15000))
                .andExpect(content().string(not(containsString("@creator_a"))));

        // Brand owner sees full roster across direct + agency creators
        mockMvc.perform(get("/api/campaigns/{cid}", activeCampId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedCreators.length()").value(2))
                .andExpect(jsonPath("$.stats.totalSpend").value(40000));

        // Agency links a Reel into the campaign with optional manual Hook Rate -> creator flips to POSTED & campaign exposes Hook Rate
        var linkReelRes = mockMvc.perform(post("/api/creators/{creatorId}/deliverables", agencyCreatorId)
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Apex Unboxing Reel\",\"reelUrl\":\"https://www.instagram.com/reel/D1ApexReel1/\",\"campaignId\":\"" + activeCampId + "\",\"hookRatePct\":\"52.4\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.campaignId").value(activeCampId))
                .andExpect(jsonPath("$.campaignTag").value("Summer Hydration"))
                .andExpect(jsonPath("$.hookRatePct").value(52.4))
                .andExpect(jsonPath("$.skipRatePct").value(47.6))
                .andExpect(jsonPath("$.hookRateSource").value("MANUAL"))
                .andReturn();
        String linkedReelId = objectMapper.readTree(linkReelRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(get("/api/campaigns/{cid}", activeCampId)
                        .header("Authorization", "Bearer " + agencyToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedCreators[0].status").value("POSTED"))
                .andExpect(jsonPath("$.assignedCreators[0].reelsCount").value(1))
                .andExpect(jsonPath("$.assignedCreators[0].hookRatePct").value(52.4))
                .andExpect(jsonPath("$.stats.avgHookRatePct").value(52.4));

        mockMvc.perform(put("/api/creators/deliverables/{did}", linkedReelId)
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hookRatePct\":61.2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hookRatePct").value(61.2))
                .andExpect(jsonPath("$.skipRatePct").value(38.8));

        // Campaign rename propagates campaignTag onto linked deliverables
        mockMvc.perform(patch("/api/campaigns/{cid}", activeCampId)
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Summer Hydration 2026\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.campaign.name").value("Summer Hydration 2026"))
                .andExpect(jsonPath("$.deliverables[0].campaignTag").value("Summer Hydration 2026"));

        // Deleting campaign retains synced Reels without recreating deleted campaign via legacy migration
        mockMvc.perform(delete("/api/campaigns/{cid}", activeCampId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));

        mockMvc.perform(get("/api/brands/{id}/campaigns", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Secret Q4 Launch"));

        mockMvc.perform(get("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliverables.length()").value(1));
    }

    @Test
    void enforcesCampaignHashtagRulesAndAgencyScopedHashtagAnalytics() throws Exception {
        String tokenA = jwtService.generateToken(managerA);

        mockMvc.perform(post("/api/brands/{id}/agencies", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Pulse Agency\",\"contactName\":\"Pulse Lead\",\"contactEmail\":\"pulse@agency.test\",\"status\":\"CONNECTED\"}"))
                .andExpect(status().isOk());

        User agencyUser = new User();
        agencyUser.setName("Pulse Lead");
        agencyUser.setEmail("pulse@agency.test");
        agencyUser.setRole("BRAND_MANAGER");
        agencyUser.setVerified(true);
        agencyUser.setPasswordHash(passwordEncoder.encode("AgencyPass9!"));
        agencyUser = userRepository.save(agencyUser);
        String agencyToken = jwtService.generateToken(agencyUser);

        var campRes = mockMvc.perform(post("/api/brands/{id}/campaigns", brandA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Glow Compliance Wave\",\"status\":\"ACTIVE\",\"requiredHashtags\":\"SummerDrop, ##BrandIndia\",\"requireDisclosure\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.campaign.requiredHashtags").value("#SummerDrop, #BrandIndia"))
                .andExpect(jsonPath("$.campaign.requireDisclosure").value(true))
                .andReturn();
        String campId = objectMapper.readTree(campRes.getResponse().getContentAsString())
                .get("campaign").get("id").asText();

        // Partner Agency cannot mutate campaign hashtag compliance rules
        mockMvc.perform(patch("/api/campaigns/{cid}", campId)
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requiredHashtags\":\"#FakeTag\",\"requireDisclosure\":false}"))
                .andExpect(status().isForbidden());

        var agencyCreatorRes = mockMvc.perform(post("/api/brands/{id}/creators", brandA.getId())
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Agency Creator\",\"handle\":\"@agency_tagger\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String agencyCreatorId = objectMapper.readTree(agencyCreatorRes.getResponse().getContentAsString())
                .get("id").asText();

        // Brand-direct compliant deliverable
        var brandDelRes = mockMvc.perform(post("/api/creators/{id}/deliverables", creatorA.getId())
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Compliant Launch\",\"reelUrl\":\"https://www.instagram.com/reel/C9HashComp01/\",\"campaignTag\":\"Glow Compliance Wave\",\"caption\":\"Routine #SummerDrop #BrandIndia #BrandExclusive #ad\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String brandDelId = objectMapper.readTree(brandDelRes.getResponse().getContentAsString())
                .get("id").asText();

        // Agency non-compliant deliverable (missing #BrandIndia and #ad disclosure)
        var agencyDelRes = mockMvc.perform(post("/api/creators/{id}/deliverables", agencyCreatorId)
                        .header("Authorization", "Bearer " + agencyToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Agency Post\",\"reelUrl\":\"https://www.instagram.com/reel/C9HashAgency01/\",\"campaignTag\":\"Glow Compliance Wave\",\"caption\":\"Try this #SummerDrop #AgencyStyle\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String agencyDelId = objectMapper.readTree(agencyDelRes.getResponse().getContentAsString())
                .get("id").asText();

        // Brand Manager sees both deliverables in campaign detail + 50% compliance
        mockMvc.perform(get("/api/campaigns/{cid}", campId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.complianceSummary.hasRules").value(true))
                .andExpect(jsonPath("$.complianceSummary.compliantCount").value(1))
                .andExpect(jsonPath("$.complianceSummary.nonCompliantCount").value(1))
                .andExpect(jsonPath("$.complianceSummary.complianceRatePct").value(50.0))
                .andExpect(jsonPath("$.deliverableCompliance['" + brandDelId + "'].status").value("COMPLIANT"))
                .andExpect(jsonPath("$.deliverableCompliance['" + agencyDelId + "'].status").value("MISSING_BOTH"));

        // Partner Agency sees strictly agency-scoped hashtagAnalytics & compliance in overview and campaign detail
        mockMvc.perform(get("/api/campaigns/{cid}", campId)
                        .header("Authorization", "Bearer " + agencyToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliverables.length()").value(1))
                .andExpect(jsonPath("$.complianceSummary.nonCompliantCount").value(1))
                .andExpect(content().string(not(containsString("#BrandExclusive"))));

        mockMvc.perform(get("/api/brands/{id}", brandA.getId())
                        .header("Authorization", "Bearer " + agencyToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hashtagAnalytics.length()").value(2))
                .andExpect(content().string(containsString("#AgencyStyle")))
                .andExpect(content().string(not(containsString("#BrandExclusive"))));
    }
}
