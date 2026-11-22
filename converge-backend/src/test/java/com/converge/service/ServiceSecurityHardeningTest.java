package com.converge.service;

import com.converge.ConvergeApplication;
import com.converge.config.InstagramProperties;
import com.converge.entity.Agency;
import com.converge.entity.AuditLog;
import com.converge.entity.Brand;
import com.converge.entity.Creator;
import com.converge.entity.User;
import com.converge.repository.AgencyRepository;
import com.converge.repository.AuditLogRepository;
import com.converge.repository.BrandRepository;
import com.converge.repository.CreatorRepository;
import com.converge.repository.ReelDeliverableRepository;
import com.converge.repository.UserRepository;
import com.converge.security.AuthRateLimitFilter;
import com.converge.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
class ServiceSecurityHardeningTest {

    @Mock private BrandRepository brandRepository;
    @Mock private AgencyRepository agencyRepository;
    @Mock private CreatorRepository creatorRepository;
    @Mock private ReelDeliverableRepository reelRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;
    @Mock private InstagramGraphService instagramGraphService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private JwtService jwtService;
    private BrandService brandService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService("test-jwt-secret-value-at-least-48-bytes-long-1234", 86400000L);
        brandService = new BrandService(
                brandRepository, agencyRepository, creatorRepository,
                reelRepository, auditLogRepository, userRepository, emailService,
                instagramGraphService, "admin@converge.test"
        );
    }

    @Test
    void jwtServiceRejectsShortSecretsAndHostedWeakDefaults() {
        assertThrows(IllegalStateException.class, () -> new JwtService("short-key", 86400000L));

        MockEnvironment prodEnv = new MockEnvironment().withProperty("RENDER", "true");
        assertThrows(IllegalStateException.class, () -> new JwtService("", 86400000L, prodEnv));
        assertThrows(IllegalStateException.class, () -> new JwtService(
                "converge-v2-super-secret-jwt-signing-key-must-be-at-least-64-bytes-long-for-hs512",
                86400000L,
                prodEnv
        ));

        MockEnvironment localEnv = new MockEnvironment();
        JwtService localRandom = assertDoesNotThrow(() -> new JwtService("", 86400000L, localEnv));
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setEmail("local@example.com");
        u.setName("Local");
        u.setRole("BRAND_MANAGER");
        assertEquals(JwtService.ISSUER, localRandom.parseClaims(localRandom.generateToken(u)).getIssuer());
    }

    @Test
    void jwtOAuthStateTokensBindCreatorAndActorAndRejectMismatch() {
        UUID creatorId = UUID.randomUUID();
        String state = jwtService.generateInstagramOAuthState(creatorId, "owner@brand.com");

        assertEquals(creatorId, jwtService.parseInstagramOAuthState(state, "owner@brand.com", false));
        assertEquals(creatorId, jwtService.parseInstagramOAuthState(state, "admin@converge.test", true));
        assertThrows(IllegalArgumentException.class,
                () -> jwtService.parseInstagramOAuthState(state, "other@brand.com", false));
        assertThrows(IllegalArgumentException.class,
                () -> jwtService.parseInstagramOAuthState(creatorId.toString(), "owner@brand.com", false));
    }

    @Test
    void dataSeederRequiresStrongBcryptHashInProductionAndGeneratesRandomLocally() {
        MockEnvironment prodEnv = new MockEnvironment().withProperty("RENDER", "true");
        when(userRepository.existsByEmailIgnoreCase("admin@converge.test")).thenReturn(false);

        DataSeeder missingHashSeeder = new DataSeeder(userRepository, passwordEncoder, "admin@converge.test", "", prodEnv);
        assertThrows(IllegalStateException.class, missingHashSeeder::run);

        DataSeeder badHashSeeder = new DataSeeder(userRepository, passwordEncoder, "admin@converge.test", "plaintext", prodEnv);
        assertThrows(IllegalStateException.class, badHashSeeder::run);

        MockEnvironment localEnv = new MockEnvironment();
        DataSeeder localSeeder = new DataSeeder(userRepository, passwordEncoder, "admin@converge.test", "", localEnv);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        localSeeder.run();
        verify(userRepository).save(argThat(u ->
                "SYSTEM_ADMIN".equals(u.getRole())
                        && u.getPasswordHash() != null
                        && u.getPasswordHash().startsWith("$2")
                        && !passwordEncoder.matches("Admin@12345", u.getPasswordHash())
        ));
    }

    @Test
    void authServiceRejectsLegacySha512AndPlaintextPasswordFallbacks() throws Exception {
        AuthService authService = new AuthService(
                userRepository, brandRepository, passwordEncoder, jwtService, emailService,
                "admin@converge.test", "test-google-client-id"
        );

        MessageDigest md = MessageDigest.getInstance("SHA-512");
        String sha512 = Base64.getEncoder().encodeToString(md.digest("Secret123!".getBytes(StandardCharsets.UTF_8)));

        User shaUser = new User();
        shaUser.setId(UUID.randomUUID());
        shaUser.setEmail("sha@example.com");
        shaUser.setPasswordHash(sha512);
        when(userRepository.findByEmailIgnoreCase("sha@example.com")).thenReturn(Optional.of(shaUser));
        assertThrows(IllegalArgumentException.class, () -> authService.login("sha@example.com", "Secret123!"));

        User plainUser = new User();
        plainUser.setId(UUID.randomUUID());
        plainUser.setEmail("plain@example.com");
        plainUser.setPasswordHash("Secret123!");
        when(userRepository.findByEmailIgnoreCase("plain@example.com")).thenReturn(Optional.of(plainUser));
        assertThrows(IllegalArgumentException.class, () -> authService.login("plain@example.com", "Secret123!"));
    }

    @Test
    void signupBlocksWorkspacePreTakeoverWithoutValidActivationToken() {
        AuthService authService = new AuthService(
                userRepository, brandRepository, passwordEncoder, jwtService, emailService,
                "admin@converge.test", "test-google-client-id"
        );

        String validInviteToken = "super-secret-onboarding-token-123";
        Brand brand = new Brand();
        brand.setId(UUID.randomUUID());
        brand.setName("Acme Skin");
        brand.setManagerEmail("victim@brand.com");
        brand.setStatus("PENDING");
        brand.setActivationToken(AuthService.sha256Hex(validInviteToken));

        when(userRepository.existsByEmailIgnoreCase("victim@brand.com")).thenReturn(false);
        when(brandRepository.findByManagerEmailIgnoreCase("victim@brand.com")).thenReturn(List.of(brand));

        assertThrows(IllegalArgumentException.class, () ->
                authService.signup("Attacker", "victim@brand.com", "AttackerPass123", "")
        );
        assertThrows(IllegalArgumentException.class, () ->
                authService.signup("Attacker", "victim@brand.com", "AttackerPass123", "wrong-token")
        );
        verify(userRepository, never()).save(any());

        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });
        Map<String, Object> res = authService.signup("Real Manager", "victim@brand.com", "ManagerPass123", validInviteToken);
        assertNotNull(res.get("token"));
        assertNull(brand.getActivationToken());
        assertEquals("ACTIVE", brand.getStatus());
        assertNotNull(brand.getManagerId());
    }

    @Test
    void signupRejectsPasswordsOver72Bytes() {
        AuthService authService = new AuthService(
                userRepository, brandRepository, passwordEncoder, jwtService, emailService,
                "admin@converge.test", "test-google-client-id"
        );
        String over72 = "a".repeat(73);
        assertThrows(IllegalArgumentException.class, () ->
                authService.signup("User", "user@example.com", over72, null)
        );
    }

    @Test
    void googleSignInRequiresConfiguredClientIdValidAudienceAndEmailVerified() {
        RestClient.Builder googleBuilder = RestClient.builder().baseUrl("https://oauth2.googleapis.com");
        MockRestServiceServer googleServer = MockRestServiceServer.bindTo(googleBuilder).build();
        RestClient.Builder userInfoBuilder = RestClient.builder().baseUrl("https://www.googleapis.com");
        MockRestServiceServer userInfoServer = MockRestServiceServer.bindTo(userInfoBuilder).build();

        AuthService unconfigured = new AuthService(
                userRepository, brandRepository, passwordEncoder, jwtService, emailService,
                "admin@converge.test", "", googleBuilder.build(), userInfoBuilder.build()
        );
        assertThrows(IllegalStateException.class, () -> unconfigured.googleSignIn("idtok", null));

        AuthService authService = new AuthService(
                userRepository, brandRepository, passwordEncoder, jwtService, emailService,
                "admin@converge.test", "expected-client.apps.googleusercontent.com",
                googleBuilder.build(), userInfoBuilder.build()
        );

        googleServer.expect(requestTo(containsString("/tokeninfo?id_token=")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"aud\":\"other-app.apps.googleusercontent.com\",\"email\":\"u@co.com\",\"email_verified\":true,\"sub\":\"111\"}", MediaType.APPLICATION_JSON));
        assertThrows(IllegalArgumentException.class, () -> authService.googleSignIn("idtok", null));
        googleServer.verify();

        googleServer.reset();
        googleServer.expect(requestTo(containsString("/tokeninfo?access_token=")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"aud\":\"expected-client.apps.googleusercontent.com\"}", MediaType.APPLICATION_JSON));
        userInfoServer.expect(requestTo(containsString("/oauth2/v3/userinfo")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"email\":\"u@co.com\",\"email_verified\":false,\"sub\":\"111\"}", MediaType.APPLICATION_JSON));
        assertThrows(IllegalArgumentException.class, () -> authService.googleSignIn(null, "accesstok"));
        googleServer.verify();
        userInfoServer.verify();
    }

    @Test
    void agencyPermissionUpdateBlocksCrossBrandIdor() {
        UUID brandA = UUID.randomUUID();
        UUID brandB = UUID.randomUUID();
        UUID agencyId = UUID.randomUUID();
        Agency agency = new Agency();
        agency.setId(agencyId);
        agency.setBrandId(brandB);

        when(agencyRepository.findById(agencyId)).thenReturn(Optional.of(agency));

        assertThrows(AccessDeniedException.class, () ->
                brandService.updateAgencyPermissions(brandA, agencyId, Map.of("roleBadge", "Owner"))
        );
        verify(agencyRepository, never()).save(any());
    }

    @Test
    void csvExportNeutralizesSpreadsheetFormulaInjection() {
        UUID brandId = UUID.randomUUID();
        Brand brand = new Brand();
        brand.setId(brandId);
        brand.setName("=HYPERLINK(\"http://evil.com\",\"Click\")");
        brand.setCode("BRD-10001");

        Creator c = new Creator();
        c.setId(UUID.randomUUID());
        c.setBrandId(brandId);
        c.setName("+CMD|' /C calc'!A0");
        c.setHandle("@normalcreator");
        c.setCampaignName(" -1+1");
        c.setAgencyName("\t=2+2");

        when(brandRepository.findById(brandId)).thenReturn(Optional.of(brand));
        when(creatorRepository.findByBrandIdOrderByLinkedAtDesc(brandId)).thenReturn(List.of(c));
        when(reelRepository.findByBrandIdOrderBySyncedAtDesc(brandId)).thenReturn(List.of());

        String csv = brandService.exportBrandCsv(brandId);
        assertTrue(csv.contains("\"'=HYPERLINK(\"\"http://evil.com\"\",\"\"Click\"\")\""));
        assertTrue(csv.contains("\"'+CMD|' /C calc'!A0\""));
        assertTrue(csv.contains("\"'@normalcreator\""));
        assertTrue(csv.contains("\"' -1+1\""));
        assertTrue(csv.contains("\"'\t=2+2\""));
    }

    @Test
    void auditLogsClampPaginationAndHandleNullDescriptionSafely() {
        UUID brandId = UUID.randomUUID();
        AuditLog logEntry = new AuditLog();
        logEntry.setBrandId(brandId);
        logEntry.setCategory("SYSTEM");
        logEntry.setEventCode("EVT-1000-SY");
        logEntry.setTitle("Created");
        logEntry.setDescription(null);

        when(auditLogRepository.findByBrandIdOrderByCreatedAtDesc(brandId)).thenReturn(List.of(logEntry));

        Map<String, Object> overflowPage = brandService.listAuditLogs(brandId, null, "created", Integer.MAX_VALUE, 500);
        assertEquals(1, overflowPage.get("total"));
        assertEquals(100, overflowPage.get("size"));
        assertTrue(((List<?>) overflowPage.get("items")).isEmpty());

        Map<String, Object> negativePage = brandService.listAuditLogs(brandId, null, "created", -5, -1);
        assertEquals(0, negativePage.get("page"));
        assertEquals(1, negativePage.get("size"));
        assertEquals(1, ((List<?>) negativePage.get("items")).size());
    }

    @Test
    void associatedBrandsOmitsCrossTenantBrandsForNonAdminCallers() {
        UUID creatorId = UUID.randomUUID();
        UUID brand1Id = UUID.randomUUID();
        UUID brand2Id = UUID.randomUUID();

        Creator c1 = new Creator();
        c1.setId(creatorId);
        c1.setBrandId(brand1Id);
        c1.setHandle("@creator");

        Creator c2 = new Creator();
        c2.setId(UUID.randomUUID());
        c2.setBrandId(brand2Id);
        c2.setHandle("@creator");

        Brand b1 = new Brand();
        b1.setId(brand1Id);
        b1.setName("BIODERMA (IN)");
        b1.setManagerEmail("mgr1@brand.com");

        Brand b2 = new Brand();
        b2.setId(brand2Id);
        b2.setName("CompetitorBrand");
        b2.setManagerEmail("mgr2@other.com");

        when(creatorRepository.findById(creatorId)).thenReturn(Optional.of(c1));
        when(reelRepository.findByCreatorIdOrderBySyncedAtDesc(creatorId)).thenReturn(List.of());
        when(creatorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(creatorRepository.findByHandleIgnoreCase("@creator")).thenReturn(List.of(c1, c2));
        when(brandRepository.findAllById(any())).thenReturn(List.of(b1, b2));
        InstagramGraphService realHelper = new InstagramGraphService(new InstagramProperties());
        when(instagramGraphService.buildCreatorInsightsSummary(any(), any(), any()))
                .thenAnswer(inv -> realHelper.buildCreatorInsightsSummary(inv.getArgument(0), inv.getArgument(1), inv.getArgument(2)));

        Map<String, Object> nonAdminRes = brandService.getCreatorInsights(creatorId, false, "mgr1@brand.com");
        assertEquals(List.of("BIODERMA (IN)"), nonAdminRes.get("associatedBrands"));

        Map<String, Object> adminRes = brandService.getCreatorInsights(creatorId, true, "admin@converge.test");
        assertEquals(List.of("BIODERMA (IN)", "CompetitorBrand"), adminRes.get("associatedBrands"));
    }

    @Test
    void instagramValidationRejectsSpoofedUrlsHandleInjectionAndMismatchedOAuthIdentity() {
        assertNull(InstagramGraphService.extractShortcode("https://evil.com/reel/AbC1234/"));
        assertNull(InstagramGraphService.extractShortcode("https://instagram.com.evil.com/reel/AbC1234/"));
        assertNull(InstagramGraphService.extractShortcode("http://www.instagram.com/reel/AbC1234/"));
        assertEquals("AbC1234", InstagramGraphService.extractShortcode("https://www.instagram.com/creator_handle/reel/AbC1234/"));

        InstagramProperties props = new InstagramProperties();
        props.setAccessToken("tok");
        props.setBusinessAccountId("12345");
        InstagramGraphService ig = new InstagramGraphService(props);
        assertThrows(IllegalArgumentException.class, () ->
                ig.inspectPublicReel("https://www.instagram.com/reel/AbC1234/", "bad){media}")
        );

        UUID creatorId = UUID.randomUUID();
        Creator creator = new Creator();
        creator.setId(creatorId);
        creator.setBrandId(UUID.randomUUID());
        creator.setHandle("@expected_creator");
        when(creatorRepository.findById(creatorId)).thenReturn(Optional.of(creator));

        assertThrows(IllegalArgumentException.class, () ->
                brandService.attachCreatorOAuthProfile(creatorId, Map.of(
                        "username", "different_person",
                        "igUserId", "999",
                        "accessToken", "tok",
                        "expiresAt", Instant.now().plusSeconds(3600)
                ))
        );
    }

    @Test
    void deploymentAndEmailAndRateLimitDefenses() throws Exception {
        assertFalse(ConvergeApplication.isH2FallbackAllowed(k -> "RENDER".equals(k) ? "true" : ""));
        assertFalse(ConvergeApplication.isH2FallbackAllowed(k -> "ALLOW_H2_FALLBACK".equals(k) ? "false" : ""));
        assertTrue(ConvergeApplication.isH2FallbackAllowed(k -> ""));

        assertEquals("https://converge-etp.pages.dev", EmailService.normalizeFrontendUrl("javascript:alert(1)"));
        assertEquals("https://converge-etp.pages.dev", EmailService.normalizeFrontendUrl("data:text/html,xss"));
        String sanitizedSubject = EmailService.sanitizeHeaderText("Subject\r\nBcc: evil@attacker.com\nLine");
        assertFalse(sanitizedSubject.contains("\r"));
        assertFalse(sanitizedSubject.contains("\n"));
        assertEquals("Subject  Bcc: evil@attacker.com Line", sanitizedSubject);

        AuthRateLimitFilter filter = new AuthRateLimitFilter(2, 60_000L);
        for (int i = 0; i < 2; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
            req.setRemoteAddr("203.0.113.10");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
        MockHttpServletRequest blockedReq = new MockHttpServletRequest("POST", "/api/auth/login");
        blockedReq.setRemoteAddr("203.0.113.10");
        MockHttpServletResponse blockedRes = new MockHttpServletResponse();
        filter.doFilter(blockedReq, blockedRes, new MockFilterChain());
        assertEquals(429, blockedRes.getStatus());
    }
}
