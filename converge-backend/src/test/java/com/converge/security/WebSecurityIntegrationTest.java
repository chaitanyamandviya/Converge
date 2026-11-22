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

    private User adminUser;
    private User managerA;
    private User managerB;
    private Brand brandA;
    private Creator creatorA;

    @BeforeEach
    void initData() {
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
}
