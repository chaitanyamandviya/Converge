package com.converge.service;

import com.converge.config.InstagramProperties;
import com.converge.entity.Creator;
import com.converge.entity.ReelDeliverable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class InstagramGraphServiceTest {

    private InstagramProperties properties;
    private MockRestServiceServer mockServer;
    private InstagramGraphService service;

    @BeforeEach
    void setUp() {
        properties = new InstagramProperties();
        properties.setBaseUrl("https://graph.facebook.com/v22.0");
        properties.setGraphBaseUrl("https://graph.instagram.com/v22.0");
        properties.setAccessToken("EAATESTTOKEN123");
        properties.setBusinessAccountId("17841400001234567");
        properties.setAppId("app123");
        properties.setAppSecret("secret456");

        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();
        service = new InstagramGraphService(properties, builder);
    }

    @Test
    void extractsHandleShortcodeAndAppSecretProofCorrectly() {
        assertEquals("@aman_creator", InstagramGraphService.normalizeHandle("https://www.instagram.com/Aman_Creator/?hl=en"));
        assertEquals("@aman_creator", InstagramGraphService.normalizeHandle("@aman_creator"));
        assertEquals("C9xYz12AbC", InstagramGraphService.extractShortcode("https://www.instagram.com/reel/C9xYz12AbC/?igsh=123"));
        assertEquals("P123_abc", InstagramGraphService.extractShortcode("https://instagram.com/p/P123_abc/"));
        assertNull(InstagramGraphService.extractShortcode("https://example.com/not-ig"));

        String proof = service.computeAppSecretProof("EAATESTTOKEN123");
        assertNotNull(proof);
        assertEquals(64, proof.length());
    }

    @Test
    void fetchesCreatorProfileViaMetaBusinessDiscovery() {
        String payload = """
            {
              "business_discovery": {
                "id": "17841499999999999",
                "username": "bioderma_creator",
                "name": "Riya Verma",
                "biography": "Skincare & Dermatologist Reels",
                "website": "https://riya.bio",
                "profile_picture_url": "https://cdn.ig/avatar.jpg",
                "followers_count": 245600,
                "follows_count": 310,
                "media_count": 148,
                "media": {
                  "data": [
                    {
                      "id": "1801234567890",
                      "caption": "Hydration routine",
                      "media_type": "VIDEO",
                      "media_product_type": "REELS",
                      "permalink": "https://www.instagram.com/reel/C9xYz12AbC/",
                      "timestamp": "2026-11-15T10:30:00+0000",
                      "like_count": 4820,
                      "comments_count": 195,
                      "view_count": 1963448,
                      "thumbnail_url": "https://cdn.ig/reel_thumb.jpg"
                    }
                  ]
                }
              }
            }
            """;

        mockServer.expect(requestTo(containsString("business_discovery.username(bioderma_creator)")))
                .andExpect(requestTo(containsString("appsecret_proof=")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(payload, MediaType.APPLICATION_JSON));

        Map<String, Object> profile = service.fetchCreatorProfile("@bioderma_creator");

        assertEquals("17841499999999999", profile.get("igUserId"));
        assertEquals("Riya Verma", profile.get("name"));
        assertEquals(245600L, profile.get("followersCount"));
        assertEquals("245.6K", profile.get("followersDisplay"));
        assertEquals("https://cdn.ig/avatar.jpg", profile.get("avatarUrl"));
        assertEquals(1963448L, profile.get("totalRecentViews"));
        assertEquals("META_BUSINESS_DISCOVERY", profile.get("source"));

        mockServer.verify();
    }

    @Test
    void syncsConnectedCreatorReelWithRealGraphInsights() {
        Creator creator = new Creator();
        creator.setId(UUID.randomUUID());
        creator.setHandle("@riya_creator");
        creator.setFollowersCount(100000L);
        creator.setIgConnected(true);
        creator.setIgAccessToken("IG_CREATOR_TOKEN");

        ReelDeliverable reel = new ReelDeliverable();
        reel.setReelUrl("https://www.instagram.com/reel/C9xYz12AbC/");

        String meMediaJson = """
            {
              "data": [
                {
                  "id": "180999888777",
                  "media_type": "VIDEO",
                  "media_product_type": "REELS",
                  "permalink": "https://www.instagram.com/reel/C9xYz12AbC/",
                  "like_count": 3200,
                  "comments_count": 140,
                  "thumbnail_url": "https://cdn.ig/thumb.jpg"
                }
              ]
            }
            """;

        String mediaJson = """
            {
              "id": "180999888777",
              "media_type": "VIDEO",
              "media_product_type": "REELS",
              "permalink": "https://www.instagram.com/reel/C9xYz12AbC/",
              "like_count": 3200,
              "comments_count": 140,
              "thumbnail_url": "https://cdn.ig/thumb.jpg"
            }
            """;

        String insightsJson = """
            {
              "data": [
                {"name": "views", "values": [{"value": 85000}]},
                {"name": "likes", "values": [{"value": 3200}]},
                {"name": "comments", "values": [{"value": 140}]}
              ]
            }
            """;

        mockServer.expect(requestTo(containsString("/me/media")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(meMediaJson, MediaType.APPLICATION_JSON));

        mockServer.expect(requestTo(containsString("/180999888777?fields=")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(mediaJson, MediaType.APPLICATION_JSON));

        mockServer.expect(requestTo(containsString("/180999888777/insights")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(insightsJson, MediaType.APPLICATION_JSON));

        service.syncReelDeliverable(reel, creator);

        assertEquals("VERIFIED", reel.getStatus());
        assertEquals("META_GRAPH_INSIGHTS", reel.getMetricsSource());
        assertEquals("REELS", reel.getMediaType());
        assertEquals(85000L, reel.getViewsCount());
        assertEquals(0L, reel.getReachCount());
        assertEquals(3200L, reel.getLikesCount());
        assertEquals(140L, reel.getCommentsCount());
        assertEquals(0L, reel.getSavesCount());
        assertEquals(0L, reel.getSharesCount());
        assertEquals(3.93, reel.getEngagementRate());

        mockServer.verify();
    }

    @Test
    void kpiSummaryUsesOnlyTrackedReelsIgnoringUntrackedFeedMedia() {
        Creator creator = new Creator();
        creator.setId(UUID.randomUUID());
        creator.setFollowersCount(587L);
        creator.setFollowersDisplay("587");

        List<Map<String, Object>> untrackedFeed = List.of(
                Map.of("shortcode", "Untracked1", "viewsCount", 4400L, "likeCount", 200L, "commentsCount", 20L, "mediaProductType", "REELS")
        );

        Map<String, Object> emptySummary = service.buildCreatorInsightsSummary(creator, List.of(), untrackedFeed);
        Map<?, ?> emptyKpis = (Map<?, ?>) emptySummary.get("kpiSummary");
        assertEquals(0L, emptyKpis.get("totalViews"));
        assertEquals(0L, emptyKpis.get("totalLikes"));
        assertEquals(0L, emptyKpis.get("totalComments"));
        assertEquals(0, emptyKpis.get("submittedDeliverables"));
    }

    @Test
    void doesNotFabricateMetricsWhenMetaCredentialsMissing() {
        properties.setAccessToken("");
        properties.setBusinessAccountId("");

        ReelDeliverable reel = new ReelDeliverable();
        reel.setReelUrl("https://www.instagram.com/reel/C9xYz12AbC/");
        reel.setCreatorHandle("@riya_creator");

        service.syncReelDeliverable(reel, null);

        assertEquals("PENDING_META_SYNC", reel.getStatus());
        assertEquals("PENDING_META_API", reel.getMetricsSource());
        assertEquals(0L, reel.getViewsCount());
        assertEquals(0L, reel.getLikesCount());
        assertThrows(IllegalStateException.class, () -> service.fetchCreatorProfile("@riya_creator"));
    }

    @Test
    void extractsRecentSignalsAndEvaluatesCreatorInsightsSummary() {
        assertEquals("@stellaartalent", InstagramGraphService.extractManagementHandle("Artist • Managed by @stellaartalent"));

        String recentTs = Instant.now().minus(3, ChronoUnit.DAYS).toString();
        List<Map<String, Object>> media = List.of(
                Map.of(
                        "id", "m1",
                        "caption", "New skincare drop #paidpartnership with @oziva and @chaupal_punjabi",
                        "timestamp", recentTs,
                        "likeCount", 12000L,
                        "commentsCount", 350L
                )
        );

        Map<String, Object> signals = service.analyzeRecentMediaSignals(media, "jasminbhasin2806", 8500000L);
        assertEquals(true, signals.get("postedLast28Days"));
        assertEquals(12350L, signals.get("publicInteractions30d"));
        assertEquals(1, signals.get("partnershipAdCount"));
        assertEquals(List.of("@oziva", "@chaupal_punjabi"), signals.get("detectedBrandPartners"));

        Creator creator = new Creator();
        creator.setId(UUID.randomUUID());
        creator.setHandle("@jasminbhasin2806");
        creator.setName("Jasmine Bhasin");
        creator.setCategory("Artist");
        creator.setCountry("India");
        creator.setGender("Female");
        creator.setAgeBracket("Aged 35-44");
        creator.setFollowersCount(8500000L);
        creator.setFollowersDisplay("8.5M");
        creator.setAccountInteractions30d(2400000L);
        creator.setTotalViews30d(80700000L);
        creator.setInteractionRate90d(6.1);
        creator.setHookRate90d(54.3);
        creator.setPartnershipAdCount(3);
        creator.setPostedLast28Days(true);
        creator.setPreviousBrandPartners("CHAUPAL Punjabi, OZiva");

        service.evaluateCreatorQualification(creator);
        assertTrue(creator.isTopCollaborator());
        assertEquals("HIGH", creator.getPredictedAdPerformance());

        Map<String, Object> summary = service.buildCreatorInsightsSummary(creator, List.of());
        Map<?, ?> overview = (Map<?, ?>) summary.get("insightsOverview");
        assertEquals("8.5M", overview.get("totalFollowersDisplay"));
        assertEquals("2.4M", overview.get("accountInteractionsDisplay"));
        assertEquals("80.7M", overview.get("totalViewsDisplay"));
        assertEquals(List.of("CHAUPAL Punjabi", "OZiva"), summary.get("previousBrandPartners"));
    }

    @Test
    void syncsOAuthAccountInsightsAndDemographicsWhenConnected() {
        Creator creator = new Creator();
        creator.setId(UUID.randomUUID());
        creator.setHandle("@jasminbhasin2806");
        creator.setIgConnected(true);
        creator.setIgAccessToken("CREATOR_TOKEN");

        String meJson = """
            {"user_id":"999","username":"jasminbhasin2806","name":"Jasmine Bhasin","followers_count":8500000,"follows_count":410,"media_count":920}
            """;
        String accountInsightsJson = """
            {
              "data": [
                {"name": "total_interactions", "total_value": {"value": 2400000}},
                {"name": "views", "total_value": {"value": 80700000}},
                {"name": "reach", "total_value": {"value": 40000000}}
              ]
            }
            """;
        String countryJson = """
            {
              "data": [{
                "name": "follower_demographics",
                "total_value": {"breakdowns": [{"results": [
                  {"dimension_values": ["IN"], "value": 800},
                  {"dimension_values": ["AE"], "value": 200}
                ]}]}
              }]
            }
            """;
        String ageGenderJson = """
            {
              "data": [{
                "name": "follower_demographics",
                "total_value": {"breakdowns": [{"results": [
                  {"dimension_values": ["25-34", "F"], "value": 650},
                  {"dimension_values": ["18-24", "M"], "value": 350}
                ]}]}
              }]
            }
            """;
        String mediaJson = """
            {"data":[{"id":"m1","caption":"Partnered with @bioderma_in #ad","media_type":"VIDEO","media_product_type":"REELS","permalink":"https://instagram.com/reel/AbC123/","timestamp":"2026-11-18T10:00:00+0000","like_count":10000,"comments_count":300}]}
            """;

        properties.setBusinessAccountId(""); // ensure test covers OAuth insights path cleanly

        mockServer.expect(requestTo(containsString("/me?fields=")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(meJson, MediaType.APPLICATION_JSON));
        mockServer.expect(requestTo(containsString("metric=total_interactions")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(accountInsightsJson, MediaType.APPLICATION_JSON));
        mockServer.expect(requestTo(containsString("breakdown=country")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(countryJson, MediaType.APPLICATION_JSON));
        mockServer.expect(requestTo(containsString("breakdown=age")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(ageGenderJson, MediaType.APPLICATION_JSON));
        mockServer.expect(requestTo(containsString("/me/media")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(mediaJson, MediaType.APPLICATION_JSON));

        assertTrue(service.applyProfileIfAvailable(creator));
        assertEquals(2400000L, creator.getAccountInteractions30d());
        assertEquals(80700000L, creator.getTotalViews30d());
        assertEquals(6.0, creator.getInteractionRate90d());
        assertEquals("IN 80%, AE 20%", creator.getAudienceTopCountries());
        assertEquals("25-34 F 65%, 18-24 M 35%", creator.getAudienceAgeGender());
        assertEquals("CREATOR_OAUTH_INSIGHTS", creator.getInsightsSource());
        assertTrue(creator.isPostedLast28Days());

        mockServer.verify();
    }

    @Test
    void mapsDottedInstagramEnvKeysToCanonicalProperties() {
        Map<String, String> env = new java.util.HashMap<>();
        env.put("instagram.graph-base-url", "https://graph.facebook.com");
        env.put("instagram.api-version", "v26.0");
        env.put("instagram.user-id", "17841400000000001");
        env.put("instagram.access-token", "  \"EAATOKEN\" ");

        com.converge.ConvergeApplication.applyInstagramEnvAliases(env::get, env::put);

        assertEquals("17841400000000001", env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID"));
        assertEquals("EAATOKEN", env.get("INSTAGRAM_ACCESS_TOKEN"));
        assertEquals("https://graph.facebook.com/v26.0", env.get("INSTAGRAM_GRAPH_API_BASE_URL"));
    }

    @Test
    void calculatesHookRateFromPartnershipAd3SecondVideoViews() {
        Creator creator = new Creator();
        creator.setHandle("@jasminbhasin2806");
        creator.setIgUserId("17841400999");

        String adAccountsJson = """
            {"data":[{"id":"act_12345","account_status":1}]}
            """;
        String adsJson = """
            {
              "data": [
                {
                  "id": "ad_1",
                  "creative": {
                    "instagram_user_id": "17841400999",
                    "effective_instagram_media_id": "m1",
                    "instagram_permalink_url": "https://www.instagram.com/reel/DffQCZBtDfN/"
                  },
                  "insights": {
                    "data": [{
                      "impressions": "1000000",
                      "actions": [
                        {"action_type": "post_engagement", "value": "62000"},
                        {"action_type": "video_view", "value": "543000"}
                      ]
                    }]
                  }
                }
              ]
            }
            """;

        mockServer.expect(requestTo(containsString("/me/adaccounts")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(adAccountsJson, MediaType.APPLICATION_JSON));
        mockServer.expect(requestTo(containsString("/act_12345/ads")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(adsJson, MediaType.APPLICATION_JSON));

        service.fetchAndApplyPartnershipAdHookRateSafe(creator, List.of());

        assertEquals(54.3, creator.getHookRate90d());
        assertEquals(1, creator.getPartnershipAdCount());
        mockServer.verify();
    }

    @Test
    void backfillsReelViewsAndComputesDeliverableInsightsSummary() {
        Creator creator = new Creator();
        creator.setFollowersCount(587L);
        creator.setTotalViews30d(188L);
        creator.setInteractionRate90d(23.7);

        ReelDeliverable reel = new ReelDeliverable();
        reel.setShortcode("DeFZFzeETAt");
        reel.setLikesCount(115L);
        reel.setCommentsCount(1L);
        reel.setEngagementRate(19.76);

        Map<String, Object> media = Map.of(
                "shortcode", "DeFZFzeETAt",
                "viewsCount", 188L,
                "likeCount", 115L,
                "commentsCount", 1L,
                "caption", "Someday"
        );

        assertTrue(service.backfillDeliverableFromMedia(reel, media, creator.getFollowersCount()));
        assertEquals(188L, reel.getViewsCount());
        assertEquals(61.7, reel.getEngagementRate());

        Map<String, Object> summary = service.buildDeliverableInsightsSummary(reel, creator);
        Map<?, ?> derived = (Map<?, ?>) summary.get("derived");
        assertEquals(116L, derived.get("totalInteractions"));
        assertEquals(61.17, derived.get("likeRatePct"));
        assertEquals(100.0, derived.get("shareOfCreatorViewsPct"));
        assertEquals(38.0, derived.get("engagementVsCreatorAvgPct"));
    }

    @Test
    void cachesProfileAndSharesMediaPageAcrossMultipleLookupsAndSyncs() {
        String payload = """
            {
              "business_discovery": {
                "id": "17841499999999999",
                "username": "cached_creator",
                "name": "Cached Creator",
                "followers_count": 50000,
                "media": {
                  "data": [
                    {
                      "id": "m_1",
                      "media_type": "VIDEO",
                      "media_product_type": "REELS",
                      "permalink": "https://www.instagram.com/reel/ReelOne1/",
                      "like_count": 500,
                      "comments_count": 20,
                      "view_count": 10000
                    },
                    {
                      "id": "m_2",
                      "media_type": "VIDEO",
                      "media_product_type": "REELS",
                      "permalink": "https://www.instagram.com/reel/ReelTwo2/",
                      "like_count": 1200,
                      "comments_count": 40,
                      "view_count": 30000
                    }
                  ]
                }
              }
            }
            """;

        // Only 1 external HTTP request should occur for profile + recent media + both reel lookups!
        mockServer.expect(ExpectedCount.once(), requestTo(containsString("business_discovery.username(cached_creator)")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(payload, MediaType.APPLICATION_JSON));

        Map<String, Object> first = service.fetchCreatorProfile("@cached_creator");
        Map<String, Object> second = service.fetchCreatorProfile("@cached_creator");
        assertSame(first, second);

        ReelDeliverable r1 = new ReelDeliverable();
        r1.setReelUrl("https://www.instagram.com/reel/ReelOne1/");
        r1.setCreatorHandle("@cached_creator");
        ReelDeliverable r2 = new ReelDeliverable();
        r2.setReelUrl("https://www.instagram.com/reel/ReelTwo2/");
        r2.setCreatorHandle("@cached_creator");

        service.syncReelDeliverable(r1, null);
        service.syncReelDeliverable(r2, null);

        assertEquals(10000L, r1.getViewsCount());
        assertEquals(30000L, r2.getViewsCount());
        mockServer.verify();
    }

    @Test
    void persistsReachSavesSharesAndAvgWatchTimeAndUsesDirectMediaIdFastPath() {
        Creator creator = new Creator();
        creator.setId(UUID.randomUUID());
        creator.setHandle("@oauth_creator");
        creator.setFollowersCount(100000L);
        creator.setIgConnected(true);
        creator.setIgAccessToken("IG_TOKEN");

        ReelDeliverable reel = new ReelDeliverable();
        reel.setReelUrl("https://www.instagram.com/reel/DirectId1/");
        reel.setIgMediaId("180111222333"); // already known media ID: bypasses /me/media list call!

        String mediaJson = """
            {
              "id": "180111222333",
              "media_type": "VIDEO",
              "media_product_type": "REELS",
              "permalink": "https://www.instagram.com/reel/DirectId1/",
              "like_count": 4200,
              "comments_count": 180
            }
            """;
        String insightsJson = """
            {
              "data": [
                {"name": "views", "total_value": {"value": 92000}},
                {"name": "reach", "values": [{"value": 64000}]},
                {"name": "saved", "values": [{"value": 310}]},
                {"name": "shares", "values": [{"value": 145}]},
                {"name": "ig_reels_avg_watch_time", "values": [{"value": 14200}]}
              ]
            }
            """;

        mockServer.expect(requestTo(containsString("/180111222333?fields=")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(mediaJson, MediaType.APPLICATION_JSON));
        mockServer.expect(requestTo(containsString("/180111222333/insights")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(insightsJson, MediaType.APPLICATION_JSON));

        service.syncReelDeliverable(reel, creator);

        assertEquals(92000L, reel.getViewsCount());
        assertEquals(64000L, reel.getReachCount());
        assertEquals(310L, reel.getSavesCount());
        assertEquals(145L, reel.getSharesCount());
        assertEquals(14200L, reel.getAvgWatchTimeMs());
        assertEquals(4.76, reel.getEngagementRate());
        mockServer.verify();
    }
}
