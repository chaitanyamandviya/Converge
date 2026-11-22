package com.converge.service;

import com.converge.config.InstagramProperties;
import com.converge.entity.Creator;
import com.converge.entity.ReelDeliverable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class InstagramGraphService {

    private static final Logger log = LoggerFactory.getLogger(InstagramGraphService.class);
    private static final Set<String> ALLOWED_INSTAGRAM_HOSTS = Set.of(
            "instagram.com",
            "www.instagram.com",
            "m.instagram.com",
            "instagr.am"
    );
    private static final Pattern SHORTCODE_PATTERN = Pattern.compile("^/(?:[A-Za-z0-9._]{1,30}/)?(?:p|reels?|tv)/([A-Za-z0-9_-]{4,64})(?:/|$)");
    private static final Pattern URL_OWNER_PATTERN = Pattern.compile("^/([A-Za-z0-9._]{1,30})/(?:p|reels?|tv)/[A-Za-z0-9_-]{4,64}(?:/|$)");
    private static final Pattern HANDLE_CLEAN_PATTERN = Pattern.compile("^[a-z0-9._]{1,30}$");
    private static final Pattern CURSOR_PATTERN = Pattern.compile("^[A-Za-z0-9+/=_.:-]{1,2048}$");
    private static final Pattern GRAPH_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_]{1,64}$");
    private static final Pattern BIO_MGMT_PATTERN = Pattern.compile("(?i)(?:managed\\s+by|management|mgmt|agency|represented\\s+by|talent)\\s*[:\\-]?\\s*(@[a-z0-9._]{1,30})");
    private static final Pattern BRANDED_CAPTION_PATTERN = Pattern.compile("(?i)(#ad\\b|#paidpartnership\\b|paid\\s+partnership|#sponsored\\b|#collab\\b|#brandpartner\\b)");
    private static final Pattern MENTION_PATTERN = Pattern.compile("@([a-z0-9._]{1,30})", Pattern.CASE_INSENSITIVE);
    private static final String BD_MEDIA_FIELDS_V26 = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,view_count,thumbnail_url,media_url";
    private static final String BD_MEDIA_FIELDS_LEGACY = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url";

    private static final Duration PROFILE_CACHE_TTL = Duration.ofMinutes(10);
    private static final Duration MEDIA_CACHE_TTL = Duration.ofMinutes(5);
    private static final Duration INSIGHTS_CACHE_TTL = Duration.ofMinutes(5);
    private static final int MAX_CACHE_ENTRIES = 500;

    private final InstagramProperties properties;
    private final RestClient restClient;
    private final TtlCache<Map<String, Object>> profileCache = new TtlCache<>(PROFILE_CACHE_TTL, MAX_CACHE_ENTRIES);
    private final TtlCache<MediaPageResult> mediaPageCache = new TtlCache<>(MEDIA_CACHE_TTL, MAX_CACHE_ENTRIES);
    private final TtlCache<Map<String, Object>> mediaInsightsCache = new TtlCache<>(INSIGHTS_CACHE_TTL, MAX_CACHE_ENTRIES);
    private final ConcurrentHashMap<String, CompletableFuture<?>> inFlightRequests = new ConcurrentHashMap<>();
    private volatile Instant rateLimitCooldownUntil = Instant.EPOCH;

    @Autowired
    public InstagramGraphService(InstagramProperties properties) {
        this(properties, createTimeoutRestClient());
    }

    private static RestClient createTimeoutRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(12));
        return RestClient.builder().requestFactory(factory).build();
    }

    public InstagramGraphService(InstagramProperties properties, RestClient.Builder builder) {
        this(properties, builder.build());
    }

    public InstagramGraphService(InstagramProperties properties, RestClient restClient) {
        this.properties = properties;
        this.restClient = restClient;
    }

    public boolean isTokenConfigured() {
        String token = properties.getAccessToken();
        return token != null && !token.isBlank() && !token.startsWith("your_");
    }

    public boolean isBusinessDiscoveryConfigured() {
        String bid = properties.getBusinessAccountId();
        return isTokenConfigured() && bid != null && !bid.isBlank() && !bid.startsWith("your_");
    }

    public boolean isOAuthConfigured() {
        return properties.getAppId() != null && !properties.getAppId().isBlank()
                && properties.getAppSecret() != null && !properties.getAppSecret().isBlank();
    }

    public Map<String, Object> getStatus() {
        return getStatus(false);
    }

    public Map<String, Object> getStatus(boolean includeAdminDetails) {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("configured", isBusinessDiscoveryConfigured());
        status.put("hasOAuthApp", isOAuthConfigured());
        status.put("creatorMarketplaceEnabled", properties.isCreatorMarketplaceEnabled());
        if (includeAdminDetails) {
            List<String> missing = new ArrayList<>();
            if (!isTokenConfigured()) missing.add("INSTAGRAM_ACCESS_TOKEN");
            if (properties.getBusinessAccountId() == null || properties.getBusinessAccountId().isBlank()
                    || properties.getBusinessAccountId().startsWith("your_")) {
                missing.add("INSTAGRAM_BUSINESS_ACCOUNT_ID");
            }
            status.put("hasAccessToken", isTokenConfigured());
            status.put("hasBusinessAccountId", properties.getBusinessAccountId() != null && !properties.getBusinessAccountId().isBlank());
            status.put("hasAppSecretProof", properties.getAppSecret() != null && !properties.getAppSecret().isBlank());
            status.put("missingEnvVars", missing);
        }
        return status;
    }

    public static String normalizeHandle(String rawHandle) {
        if (rawHandle == null || rawHandle.isBlank()) return "";
        String cleaned = rawHandle.trim()
                .replaceAll("^https?://(www\\.|m\\.)?instagram\\.com/", "");
        int qIdx = cleaned.indexOf('?');
        if (qIdx >= 0) cleaned = cleaned.substring(0, qIdx);
        int slashIdx = cleaned.indexOf('/');
        if (slashIdx > 0) cleaned = cleaned.substring(0, slashIdx);
        cleaned = cleaned.replaceFirst("^@+", "").trim().toLowerCase();
        return cleaned.isEmpty() ? "" : "@" + cleaned;
    }

    public static String stripAt(String rawHandle) {
        String norm = normalizeHandle(rawHandle);
        return norm.startsWith("@") ? norm.substring(1) : norm;
    }

    public static boolean isValidHandle(String rawHandle) {
        String username = stripAt(rawHandle);
        return !username.isEmpty() && HANDLE_CLEAN_PATTERN.matcher(username).matches();
    }

    public static String extractShortcode(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            URI parsed = URI.create(url.trim());
            String scheme = parsed.getScheme();
            String host = parsed.getHost();
            if (!"https".equalsIgnoreCase(scheme) || host == null) {
                return null;
            }
            String lowerHost = host.toLowerCase(Locale.ROOT);
            if (!ALLOWED_INSTAGRAM_HOSTS.contains(lowerHost)) {
                return null;
            }
            String path = parsed.getPath();
            if (path == null) return null;
            Matcher m = SHORTCODE_PATTERN.matcher(path);
            return m.find() ? m.group(1) : null;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public static String extractUrlOwnerHandle(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            URI parsed = URI.create(url.trim());
            String scheme = parsed.getScheme();
            String host = parsed.getHost();
            if (!"https".equalsIgnoreCase(scheme) || host == null) {
                return null;
            }
            if (!ALLOWED_INSTAGRAM_HOSTS.contains(host.toLowerCase(Locale.ROOT))) {
                return null;
            }
            String path = parsed.getPath();
            if (path == null) return null;
            Matcher m = URL_OWNER_PATTERN.matcher(path);
            if (!m.find()) return null;
            String owner = m.group(1).toLowerCase(Locale.ROOT);
            return HANDLE_CLEAN_PATTERN.matcher(owner).matches() ? owner : null;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public static String formatCompactNumber(long count) {
        if (count <= 0) return "—";
        if (count >= 1_000_000) return String.format(Locale.US, "%.1fM", count / 1_000_000.0);
        if (count >= 1_000) return String.format(Locale.US, "%.1fK", count / 1_000.0);
        return String.valueOf(count);
    }

    String computeAppSecretProof(String token) {
        String secret = properties.getAppSecret();
        if (secret == null || secret.isBlank() || token == null || token.isBlank()) {
            return null;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute appsecret_proof", e);
        }
    }

    public void evictCreatorCache(String rawHandle) {
        String username = stripAt(rawHandle);
        if (username.isEmpty()) return;
        profileCache.remove("profile:" + username);
        mediaPageCache.removeByPrefix("bd_page:" + username + ":");
        mediaPageCache.removeByPrefix("oauth_media:" + username + ":");
    }

    public void evictMediaCache(String igMediaId) {
        if (igMediaId == null || igMediaId.isBlank()) return;
        mediaInsightsCache.removeByPrefix("media_ins:" + igMediaId + ":");
    }

    public Map<String, Object> fetchCreatorProfile(String rawHandle) {
        return fetchCreatorProfile(rawHandle, false);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchCreatorProfile(String rawHandle, boolean forceRefresh) {
        String username = stripAt(rawHandle);
        if (username.isEmpty() || !HANDLE_CLEAN_PATTERN.matcher(username).matches()) {
            throw new IllegalArgumentException("Please enter a valid Instagram username or profile URL.");
        }
        if (!isBusinessDiscoveryConfigured()) {
            throw new IllegalStateException("Instagram Graph API is not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID in .env.");
        }

        String cacheKey = "profile:" + username;
        if (forceRefresh) {
            evictCreatorCache(username);
        } else {
            Map<String, Object> cached = profileCache.get(cacheKey);
            if (cached != null) {
                return cached;
            }
        }

        return runCoalesced(cacheKey, () -> {
            DiscoveryQueryResult queryRes = executeBusinessDiscoveryQueryWithMeta(
                    username,
                    "id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,media.limit(50){%s}"
            );
            Map<String, Object> response = queryRes.body();

            Object bdObj = response.get("business_discovery");
            if (!(bdObj instanceof Map<?, ?> bd)) {
                throw new IllegalArgumentException("Instagram account '@" + username + "' did not return business discovery profile data.");
            }

            long followers = asFlexibleLong(bd.get("followers_count"));
            long follows = asFlexibleLong(bd.get("follows_count"));
            long mediaCount = asFlexibleLong(bd.get("media_count"));
            String bio = asString(bd.get("biography"));
            List<Map<String, Object>> recentMedia = parseMediaList(bd.get("media"), queryRes.viewsSupported());
            Map<String, Object> signals = analyzeRecentMediaSignals(recentMedia, username, followers);

            String afterCursor = (bd.get("media") instanceof Map<?, ?> mw) ? extractAfterCursor(mw) : null;
            mediaPageCache.put("bd_page:" + username + ":root:50",
                    new MediaPageResult(recentMedia, afterCursor, followers, queryRes.viewsSupported()));

            Map<String, Object> marketplaceData = properties.isCreatorMarketplaceEnabled()
                    ? fetchCreatorMarketplaceDataSafe(username)
                    : Map.of();

            Map<String, Object> profile = new LinkedHashMap<>();
            profile.put("igUserId", asString(bd.get("id")));
            profile.put("username", asString(bd.get("username"), username));
            profile.put("handle", "@" + asString(bd.get("username"), username));
            profile.put("name", asString(bd.get("name"), username));
            profile.put("bio", bio);
            profile.put("website", asString(bd.get("website")));
            profile.put("avatarUrl", asString(bd.get("profile_picture_url")));
            profile.put("profileUrl", "https://www.instagram.com/" + username + "/");
            profile.put("followersCount", followers);
            profile.put("followersDisplay", formatCompactNumber(followers));
            profile.put("followsCount", follows);
            profile.put("mediaCount", mediaCount);
            profile.put("recentMedia", recentMedia);
            profile.put("postedLast28Days", signals.get("postedLast28Days"));
            profile.put("publicInteractions30d", signals.get("publicInteractions30d"));
            profile.put("totalRecentInteractions", signals.get("totalRecentInteractions"));
            profile.put("publicViews30d", signals.get("publicViews30d"));
            profile.put("totalRecentViews", signals.get("totalRecentViews"));
            profile.put("estimatedInteractionRate", signals.get("estimatedInteractionRate"));
            profile.put("partnershipAdCount", signals.get("partnershipAdCount"));
            profile.put("detectedBrandPartners", signals.get("detectedBrandPartners"));
            profile.put("suggestedManagementHandle", extractManagementHandle(bio));
            profile.put("marketplaceInsights", marketplaceData);
            profile.put("source", marketplaceData.isEmpty() ? "META_BUSINESS_DISCOVERY" : "META_CREATOR_MARKETPLACE");
            profileCache.put(cacheKey, profile);
            return profile;
        });
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> fetchRecentMedia(String rawHandle, int limit, String creatorOAuthToken) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        int firstPageLimit = Math.min(safeLimit, 50);
        String username = stripAt(rawHandle);
        if (creatorOAuthToken != null && !creatorOAuthToken.isBlank()) {
            String oauthKey = "oauth_media:" + username + ":" + safeLimit;
            MediaPageResult cachedOAuth = mediaPageCache.get(oauthKey);
            if (cachedOAuth != null) {
                return cachedOAuth.items();
            }
            for (int candidateSize : new int[]{100, 50}) {
                if (candidateSize >= safeLimit) {
                    MediaPageResult cachedLarger = mediaPageCache.get("oauth_media:" + username + ":" + candidateSize);
                    if (cachedLarger != null) {
                        List<Map<String, Object>> all = cachedLarger.items();
                        return all.size() > safeLimit ? all.subList(0, safeLimit) : all;
                    }
                }
            }
            return runCoalesced(oauthKey, () -> {
                List<Map<String, Object>> collected = new ArrayList<>();
                boolean viewsSupported = true;
                String afterCursor = null;
                int maxPages = safeLimit > 50 ? 3 : 1;
                for (int page = 0; page < maxPages && collected.size() < safeLimit; page++) {
                    int pageSize = Math.min(50, safeLimit - collected.size());
                    Map<String, String> params = new LinkedHashMap<>();
                    params.put("fields", viewsSupported ? BD_MEDIA_FIELDS_V26 : BD_MEDIA_FIELDS_LEGACY);
                    params.put("limit", String.valueOf(pageSize));
                    if (afterCursor != null && !afterCursor.isBlank()) {
                        params.put("after", afterCursor);
                    }
                    Map<String, Object> resp;
                    try {
                        resp = executeGraphGet(
                                properties.getGraphBaseUrl(),
                                "/me/media",
                                params,
                                creatorOAuthToken,
                                username
                        );
                    } catch (IllegalStateException ex) {
                        if (viewsSupported && ex.getMessage() != null && ex.getMessage().contains("view_count")) {
                            viewsSupported = false;
                            params.put("fields", BD_MEDIA_FIELDS_LEGACY);
                            resp = executeGraphGet(
                                    properties.getGraphBaseUrl(),
                                    "/me/media",
                                    params,
                                    creatorOAuthToken,
                                    username
                            );
                        } else {
                            if (page > 0) break;
                            throw ex;
                        }
                    }
                    List<Map<String, Object>> pageItems = parseMediaDataArray(resp.get("data"), viewsSupported);
                    if (pageItems.isEmpty()) break;
                    collected.addAll(pageItems);
                    afterCursor = extractAfterCursor(resp);
                    if (afterCursor == null || afterCursor.isBlank()) break;
                }
                List<Map<String, Object>> finalItems = collected.size() > safeLimit
                        ? List.copyOf(collected.subList(0, safeLimit))
                        : List.copyOf(collected);
                mediaPageCache.put(oauthKey, new MediaPageResult(finalItems, afterCursor, 0L, viewsSupported));
                return finalItems;
            });
        }

        if (username.isEmpty() || !HANDLE_CLEAN_PATTERN.matcher(username).matches()) {
            throw new IllegalArgumentException("Valid Instagram handle is required.");
        }
        if (!isBusinessDiscoveryConfigured()) {
            throw new IllegalStateException("Instagram Graph API is not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID in .env.");
        }

        MediaPageResult cachedExact = mediaPageCache.get("bd_page:" + username + ":root:" + safeLimit);
        if (cachedExact != null) {
            return cachedExact.items();
        }
        for (int candidateSize : new int[]{100, 50, 25}) {
            if (candidateSize >= safeLimit) {
                MediaPageResult cachedLarger = mediaPageCache.get("bd_page:" + username + ":root:" + candidateSize);
                if (cachedLarger != null && (cachedLarger.items().size() >= safeLimit || cachedLarger.afterCursor() == null)) {
                    List<Map<String, Object>> all = cachedLarger.items();
                    return all.size() > safeLimit ? all.subList(0, safeLimit) : all;
                }
            }
        }

        String bdKey = "bd_page:" + username + ":root:" + safeLimit;
        return runCoalesced(bdKey, () -> {
            List<Map<String, Object>> collected = new ArrayList<>();
            long followers = 0L;
            boolean viewsSupported = true;
            String afterCursor = null;

            MediaPageResult cachedFirstPage = mediaPageCache.get("bd_page:" + username + ":root:50");
            if (cachedFirstPage == null && safeLimit > 25) {
                cachedFirstPage = mediaPageCache.get("bd_page:" + username + ":root:25");
            }
            int startPage = 0;
            if (cachedFirstPage != null && !cachedFirstPage.items().isEmpty()) {
                collected.addAll(cachedFirstPage.items());
                followers = cachedFirstPage.followersCount();
                viewsSupported = cachedFirstPage.viewsSupported();
                afterCursor = cachedFirstPage.afterCursor();
                startPage = 1;
            }

            int maxPages = safeLimit > 50 ? 4 : 1;
            for (int page = startPage; page < maxPages && collected.size() < safeLimit; page++) {
                if (page > 0 && (afterCursor == null || afterCursor.isBlank())) {
                    break;
                }
                int pageLimit = page == 0 ? firstPageLimit : 50;
                String mediaExpr = (afterCursor == null)
                        ? "followers_count,media.limit(" + pageLimit + "){%s}"
                        : "followers_count,media.after(" + afterCursor + ").limit(" + pageLimit + "){%s}";
                try {
                    DiscoveryQueryResult qRes = executeBusinessDiscoveryQueryWithMeta(username, mediaExpr);
                    viewsSupported = qRes.viewsSupported();
                    Map<String, Object> resp = qRes.body();
                    if (!(resp.get("business_discovery") instanceof Map<?, ?> bd)) {
                        break;
                    }
                    followers = asFlexibleLong(bd.get("followers_count"));
                    List<Map<String, Object>> pageItems = parseMediaList(bd.get("media"), qRes.viewsSupported());
                    if (pageItems.isEmpty()) break;
                    collected.addAll(pageItems);
                    String nextCursor = (bd.get("media") instanceof Map<?, ?> mw) ? extractAfterCursor(mw) : null;
                    if (page == 0) {
                        mediaPageCache.put("bd_page:" + username + ":root:" + pageLimit,
                                new MediaPageResult(pageItems, nextCursor, followers, viewsSupported));
                    } else if (afterCursor != null) {
                        mediaPageCache.put("bd_page:" + username + ":" + afterCursor + ":50",
                                new MediaPageResult(pageItems, nextCursor, followers, viewsSupported));
                    }
                    afterCursor = nextCursor;
                } catch (Exception ex) {
                    if (page == 0) throw ex;
                    break;
                }
            }

            List<Map<String, Object>> finalItems = collected.size() > safeLimit
                    ? List.copyOf(collected.subList(0, safeLimit))
                    : List.copyOf(collected);
            mediaPageCache.put(bdKey, new MediaPageResult(finalItems, afterCursor, followers, viewsSupported));
            return finalItems;
        });
    }

    public Map<String, Object> inspectPublicReel(String reelUrl, String creatorHandle) {
        String shortcode = extractShortcode(reelUrl);
        if (shortcode == null) {
            throw new IllegalArgumentException("Enter a valid public https://www.instagram.com/reel/... URL.");
        }
        if (!isBusinessDiscoveryConfigured()) {
            throw new IllegalStateException("Instagram Graph API is not configured.");
        }
        String username = stripAt(creatorHandle);
        if (username.isEmpty() || !HANDLE_CLEAN_PATTERN.matcher(username).matches()) {
            throw new IllegalArgumentException("Valid Instagram creator handle is required for Meta Business Discovery Reel lookup.");
        }

        Map<String, Object> bdResult = lookupMediaViaBusinessDiscovery(username, shortcode);
        if (bdResult == null) {
            String urlOwner = extractUrlOwnerHandle(reelUrl);
            if (urlOwner != null && !urlOwner.equalsIgnoreCase(username)) {
                bdResult = lookupMediaViaBusinessDiscovery(urlOwner, shortcode);
            }
        }
        if (bdResult == null) {
            throw new IllegalArgumentException("Reel shortcode '" + shortcode + "' was not found in the latest public media for @" + username + ".");
        }
        return bdResult;
    }

    public Map<String, Object> fetchMediaInsights(String igMediaId, String tokenToUse, String baseUrlOverride) {
        if (igMediaId == null || !GRAPH_ID_PATTERN.matcher(igMediaId).matches()) {
            throw new IllegalArgumentException("Invalid Instagram media ID.");
        }
        String effectiveBase = (baseUrlOverride != null && !baseUrlOverride.isBlank()) ? baseUrlOverride : properties.getBaseUrl();
        String token = (tokenToUse != null && !tokenToUse.isBlank()) ? tokenToUse : properties.getAccessToken();
        if (token == null || token.isBlank()) {
            throw new IllegalStateException("Instagram access token is required.");
        }

        String cacheKey = "media_ins:" + igMediaId + ":" + effectiveBase;
        Map<String, Object> cached = mediaInsightsCache.get(cacheKey);
        if (cached != null) {
            return cached;
        }

        return runCoalesced(cacheKey, () -> {
            boolean viewsFieldSupported = true;
            Map<String, Object> media;
            try {
                media = executeGraphGet(
                        effectiveBase,
                        "/" + igMediaId,
                        Map.of("fields", BD_MEDIA_FIELDS_V26),
                        token,
                        igMediaId
                );
            } catch (IllegalStateException ex) {
                if (ex.getMessage() != null && ex.getMessage().contains("view_count")) {
                    viewsFieldSupported = false;
                    media = executeGraphGet(
                            effectiveBase,
                            "/" + igMediaId,
                            Map.of("fields", BD_MEDIA_FIELDS_LEGACY),
                            token,
                            igMediaId
                    );
                } else {
                    throw ex;
                }
            }

            Map<String, Object> result = normalizeMediaMap(media, viewsFieldSupported);
            String mediaType = resolveDisplayMediaType(result);
            long views = asLong(result.get("viewsCount"));
            long likes = asLong(result.get("likeCount"));
            long comments = asLong(result.get("commentsCount"));

            Map<String, Long> insightMetrics = fetchInsightMetricsSafe(effectiveBase, igMediaId, token, mediaType);
            if (insightMetrics.containsKey("views") && (insightMetrics.get("views") > 0 || !viewsFieldSupported)) {
                views = insightMetrics.get("views");
                result.put("viewsFieldSupported", Boolean.TRUE);
            }
            if (likes == 0 && insightMetrics.containsKey("likes")) likes = insightMetrics.get("likes");
            if (comments == 0 && insightMetrics.containsKey("comments")) comments = insightMetrics.get("comments");

            long reach = insightMetrics.getOrDefault("reach", 0L);
            long saves = insightMetrics.getOrDefault("saved", 0L);
            long shares = insightMetrics.getOrDefault("shares", 0L);
            long avgWatchTimeMs = insightMetrics.getOrDefault("ig_reels_avg_watch_time", 0L);
            long totalInteractions = insightMetrics.getOrDefault("total_interactions", likes + comments + saves + shares);

            result.put("viewsCount", views);
            result.put("reachCount", reach);
            result.put("savesCount", saves);
            result.put("sharesCount", shares);
            result.put("avgWatchTimeMs", avgWatchTimeMs);
            result.put("totalInteractions", totalInteractions);
            result.put("likeCount", likes);
            result.put("commentsCount", comments);
            result.put("source", insightMetrics.isEmpty() ? "META_GRAPH_MEDIA" : "META_GRAPH_INSIGHTS");
            mediaInsightsCache.put(cacheKey, result);
            return result;
        });
    }

    public boolean applyProfileIfAvailable(Creator creator) {
        if (creator == null) return false;
        boolean updated = false;

        if (creator.isIgConnected() && creator.getIgAccessToken() != null && !creator.getIgAccessToken().isBlank()) {
            try {
                Map<String, Object> me = executeGraphGet(
                        properties.getGraphBaseUrl(),
                        "/me",
                        Map.of("fields", "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count"),
                        creator.getIgAccessToken(),
                        creator.getHandle()
                );
                applyProfileFieldsToCreator(creator, me);
                fetchAndApplyOAuthAccountInsights(creator);
                updated = true;
            } catch (Exception ex) {
                log.warn("Creator OAuth /me refresh failed for {}: {}", creator.getHandle(), ex.getMessage());
            }
        }

        if (isBusinessDiscoveryConfigured()) {
            try {
                Map<String, Object> profile = fetchCreatorProfile(creator.getHandle());
                applyProfileFieldsToCreator(creator, profile);
                applyDiscoveredSignalsToCreator(creator, profile);
                if (!creator.isIgConnected()
                        && properties.getBusinessAccountId().equals(asString(profile.get("igUserId")))) {
                    fetchAndApplyAccountInsights(
                            creator,
                            "/" + properties.getBusinessAccountId(),
                            properties.getBaseUrl(),
                            properties.getAccessToken(),
                            false
                    );
                }
                updated = true;
            } catch (Exception ex) {
                log.warn("Instagram business_discovery profile lookup skipped for {}: {}", creator.getHandle(), ex.getMessage());
            }
        }

        if (updated) {
            evaluateCreatorQualification(creator);
        }
        return updated;
    }

    public void syncReelDeliverable(ReelDeliverable reel, Creator creator) {
        String shortcode = extractShortcode(reel.getReelUrl());
        reel.setShortcode(shortcode);
        reel.setSyncedAt(Instant.now());

        if (shortcode == null) {
            reel.setStatus("PENDING_META_SYNC");
            reel.setMetricsSource("INVALID_OR_UNPARSED_URL");
            return;
        }

        // Path A: Connected Creator OAuth Token (supports private Reels insights: views, reach, saved, shares)
        if (creator != null && creator.isIgConnected() && creator.getIgAccessToken() != null && !creator.getIgAccessToken().isBlank()) {
            try {
                String mediaId = reel.getIgMediaId();
                if (mediaId != null && GRAPH_ID_PATTERN.matcher(mediaId).matches()) {
                    try {
                        Map<String, Object> insights = fetchMediaInsights(mediaId, creator.getIgAccessToken(), properties.getGraphBaseUrl());
                        applyReelMetrics(reel, insights, creator.getFollowersCount(), "META_GRAPH_INSIGHTS");
                        return;
                    } catch (Exception directEx) {
                        log.debug("Direct OAuth media ID insights lookup fallback for {}: {}", mediaId, directEx.getMessage());
                    }
                }
                List<Map<String, Object>> ownMedia = fetchRecentMedia(creator.getHandle(), 50, creator.getIgAccessToken());
                Optional<Map<String, Object>> match = ownMedia.stream()
                        .filter(m -> matchesShortcode(m, shortcode))
                        .findFirst();
                if (match.isPresent()) {
                    String resolvedMediaId = asString(match.get().get("id"));
                    Map<String, Object> insights = fetchMediaInsights(resolvedMediaId, creator.getIgAccessToken(), properties.getGraphBaseUrl());
                    applyReelMetrics(reel, insights, creator.getFollowersCount(), "META_GRAPH_INSIGHTS");
                    return;
                }
            } catch (Exception ex) {
                log.warn("Creator OAuth media sync failed for {}: {}", creator.getHandle(), ex.getMessage());
            }
        }

        // Path A2: Creator IS our own connected Instagram Business Account (supports private Reels insights via brand token)
        if (creator != null
                && isBusinessDiscoveryConfigured()
                && properties.getBusinessAccountId().equals(creator.getIgUserId())) {
            try {
                String mediaId = reel.getIgMediaId();
                if (mediaId != null && GRAPH_ID_PATTERN.matcher(mediaId).matches()) {
                    try {
                        Map<String, Object> insights = fetchMediaInsights(mediaId, properties.getAccessToken(), properties.getBaseUrl());
                        applyReelMetrics(reel, insights, creator.getFollowersCount(), "META_GRAPH_INSIGHTS");
                        return;
                    } catch (Exception directEx) {
                        log.debug("Direct owned business media ID lookup fallback for {}: {}", mediaId, directEx.getMessage());
                    }
                }
                List<Map<String, Object>> ownMedia = fetchRecentMedia(creator.getHandle(), 50, null);
                Optional<Map<String, Object>> match = ownMedia.stream()
                        .filter(m -> matchesShortcode(m, shortcode))
                        .findFirst();
                if (match.isPresent()) {
                    String resolvedMediaId = asString(match.get().get("id"));
                    Map<String, Object> insights = fetchMediaInsights(resolvedMediaId, properties.getAccessToken(), properties.getBaseUrl());
                    applyReelMetrics(reel, insights, creator.getFollowersCount(), "META_GRAPH_INSIGHTS");
                    return;
                }
            } catch (Exception ex) {
                log.warn("Owned IG business media insights fallback for {}: {}", creator.getHandle(), ex.getMessage());
            }
        }

        // Path B: Meta System/Brand Token + Business Discovery (public engagement & media metadata)
        if (!isBusinessDiscoveryConfigured()) {
            if (!"VERIFIED".equals(reel.getStatus())) {
                reel.setStatus("PENDING_META_SYNC");
                reel.setMetricsSource("PENDING_META_API");
            }
            return;
        }

        String username = creator != null ? stripAt(creator.getHandle()) : stripAt(reel.getCreatorHandle());
        if (username.isEmpty()) {
            if (!"VERIFIED".equals(reel.getStatus())) {
                reel.setStatus("PENDING_META_SYNC");
                reel.setMetricsSource("MISSING_CREATOR_HANDLE");
            }
            return;
        }

        try {
            Map<String, Object> match = lookupMediaViaBusinessDiscovery(username, shortcode);
            if (match == null) {
                String urlOwner = extractUrlOwnerHandle(reel.getReelUrl());
                if (urlOwner != null && !urlOwner.equalsIgnoreCase(username)) {
                    match = lookupMediaViaBusinessDiscovery(urlOwner, shortcode);
                }
            }
            if (match != null) {
                long followers = asLong(match.get("creatorFollowersCount"));
                if (creator != null && followers > 0) {
                    creator.setFollowersCount(followers);
                    creator.setFollowersDisplay(formatCompactNumber(followers));
                }
                applyReelMetrics(reel, match, creator != null ? creator.getFollowersCount() : followers, "META_BUSINESS_DISCOVERY");
            } else if (!"VERIFIED".equals(reel.getStatus()) || (reel.getViewsCount() == 0 && reel.getLikesCount() == 0)) {
                reel.setStatus("NOT_FOUND");
                reel.setMetricsSource("NOT_FOUND_ON_IG");
            }
        } catch (Exception ex) {
            log.warn("Business Discovery reel sync error for {}: {}", shortcode, ex.getMessage());
            if (!"VERIFIED".equals(reel.getStatus())) {
                reel.setStatus("PENDING_META_SYNC");
                reel.setMetricsSource("META_API_ERROR");
            }
        }
    }

    public Map<String, Object> buildOAuthAuthorizeUrl(String state) {
        if (!isOAuthConfigured()) {
            throw new IllegalStateException("INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be configured in .env for Creator OAuth.");
        }
        String url = UriComponentsBuilder.fromUriString("https://www.instagram.com/oauth/authorize")
                .queryParam("enable_fb_login", "0")
                .queryParam("force_authentication", "1")
                .queryParam("client_id", properties.getAppId())
                .queryParam("redirect_uri", properties.getRedirectUri())
                .queryParam("response_type", "code")
                .queryParam("scope", "instagram_business_basic,instagram_business_manage_insights")
                .queryParam("state", state != null ? state : "")
                .build(false)
                .toUriString();

        return Map.of(
                "authorizeUrl", url,
                "redirectUri", properties.getRedirectUri(),
                "scopes", List.of("instagram_business_basic", "instagram_business_manage_insights")
        );
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> exchangeCodeForLongLivedToken(String code) {
        if (!isOAuthConfigured()) {
            throw new IllegalStateException("INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be configured in .env for OAuth token exchange.");
        }
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Authorization code is required.");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", properties.getAppId());
        form.add("client_secret", properties.getAppSecret());
        form.add("grant_type", "authorization_code");
        form.add("redirect_uri", properties.getRedirectUri());
        form.add("code", code.trim());

        Map<String, Object> shortResp;
        try {
            shortResp = restClient.post()
                    .uri("https://api.instagram.com/oauth/access_token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientResponseException ex) {
            log.warn("Instagram OAuth code exchange failed with HTTP {}", ex.getStatusCode().value());
            throw new IllegalArgumentException("Instagram OAuth code exchange failed. Please restart the creator connection flow.");
        } catch (RestClientException ex) {
            log.warn("Instagram OAuth code exchange network error: {}", ex.getClass().getSimpleName());
            throw new IllegalArgumentException("Instagram OAuth service could not be reached. Please try again shortly.");
        }

        if (shortResp == null || shortResp.get("access_token") == null) {
            throw new IllegalArgumentException("Instagram OAuth did not return an access token.");
        }

        String shortToken = String.valueOf(shortResp.get("access_token"));
        String igUserId = shortResp.get("user_id") != null ? String.valueOf(shortResp.get("user_id")) : null;

        Map<String, Object> longResp = executeGraphGet(
                properties.getGraphBaseUrl(),
                "/access_token",
                Map.of(
                        "grant_type", "ig_exchange_token",
                        "client_secret", properties.getAppSecret()
                ),
                shortToken,
                "oauth_exchange"
        );

        String finalToken = longResp.get("access_token") != null
                ? String.valueOf(longResp.get("access_token"))
                : shortToken;
        long expiresInSeconds = asLong(longResp.get("expires_in"));
        Instant expiresAt = expiresInSeconds > 0
                ? Instant.now().plusSeconds(expiresInSeconds)
                : Instant.now().plusSeconds(5184000L);

        Map<String, Object> profile = executeGraphGet(
                properties.getGraphBaseUrl(),
                "/me",
                Map.of("fields", "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count"),
                finalToken,
                "me"
        );

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("accessToken", finalToken);
        out.put("expiresAt", expiresAt);
        out.put("igUserId", asString(profile.get("user_id"), igUserId));
        out.put("username", asString(profile.get("username")));
        out.put("name", asString(profile.get("name")));
        out.put("accountType", asString(profile.get("account_type"), "CREATOR"));
        out.put("avatarUrl", asString(profile.get("profile_picture_url")));
        out.put("followersCount", asLong(profile.get("followers_count")));
        out.put("followsCount", asLong(profile.get("follows_count")));
        out.put("mediaCount", asLong(profile.get("media_count")));
        return out;
    }

    private DiscoveryQueryResult executeBusinessDiscoveryQueryWithMeta(String username, String discoveryTemplate) {
        if (username == null || !HANDLE_CLEAN_PATTERN.matcher(username).matches()) {
            throw new IllegalArgumentException("Valid Instagram handle is required.");
        }
        String fieldsV26 = "business_discovery.username(" + username + "){" + String.format(discoveryTemplate, BD_MEDIA_FIELDS_V26) + "}";
        try {
            Map<String, Object> body = executeGraphGet(
                    properties.getBaseUrl(),
                    "/" + properties.getBusinessAccountId(),
                    Map.of("fields", fieldsV26),
                    properties.getAccessToken(),
                    username
            );
            return new DiscoveryQueryResult(body, true);
        } catch (IllegalStateException ex) {
            if (ex.getMessage() != null && ex.getMessage().contains("view_count")) {
                String fieldsLegacy = "business_discovery.username(" + username + "){" + String.format(discoveryTemplate, BD_MEDIA_FIELDS_LEGACY) + "}";
                Map<String, Object> body = executeGraphGet(
                        properties.getBaseUrl(),
                        "/" + properties.getBusinessAccountId(),
                        Map.of("fields", fieldsLegacy),
                        properties.getAccessToken(),
                        username
                );
                return new DiscoveryQueryResult(body, false);
            }
            throw ex;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> lookupMediaViaBusinessDiscovery(String username, String shortcode) {
        // Fast check against cached profile/page-1 snapshots first to avoid extra Meta calls.
        for (String cachedKey : List.of("bd_page:" + username + ":root:25", "bd_page:" + username + ":root:50")) {
            MediaPageResult snap = mediaPageCache.get(cachedKey);
            if (snap != null) {
                for (Map<String, Object> item : snap.items()) {
                    if (matchesShortcode(item, shortcode)) {
                        Map<String, Object> matched = new LinkedHashMap<>(item);
                        matched.put("creatorFollowersCount", snap.followersCount());
                        matched.put("source", "META_BUSINESS_DISCOVERY");
                        return matched;
                    }
                }
            }
        }

        String afterCursor = null;
        for (int page = 0; page < 3; page++) {
            String cursorKey = (afterCursor == null) ? "root" : afterCursor;
            String cacheKey = "bd_page:" + username + ":" + cursorKey + ":50";
            final String currentCursor = afterCursor;

            MediaPageResult pageRes = mediaPageCache.get(cacheKey);
            if (pageRes == null) {
                pageRes = runCoalesced(cacheKey, () -> {
                    String mediaExpr = (currentCursor == null)
                            ? "followers_count,media.limit(50){%s}"
                            : "followers_count,media.after(" + currentCursor + ").limit(50){%s}";
                    DiscoveryQueryResult qRes = executeBusinessDiscoveryQueryWithMeta(username, mediaExpr);
                    Map<String, Object> body = qRes.body();
                    if (!(body.get("business_discovery") instanceof Map<?, ?> bd)) {
                        return new MediaPageResult(List.of(), null, 0L, qRes.viewsSupported());
                    }
                    long followers = asFlexibleLong(bd.get("followers_count"));
                    if (bd.get("media") instanceof Map<?, ?> mediaWrapper) {
                        List<Map<String, Object>> parsed = parseMediaDataArray(mediaWrapper.get("data"), qRes.viewsSupported());
                        String next = extractAfterCursor(mediaWrapper);
                        MediaPageResult built = new MediaPageResult(parsed, next, followers, qRes.viewsSupported());
                        mediaPageCache.put(cacheKey, built);
                        return built;
                    }
                    return new MediaPageResult(List.of(), null, followers, qRes.viewsSupported());
                });
            }

            if (pageRes == null || pageRes.items().isEmpty()) {
                return null;
            }
            for (Map<String, Object> item : pageRes.items()) {
                if (matchesShortcode(item, shortcode)) {
                    Map<String, Object> matched = new LinkedHashMap<>(item);
                    matched.put("creatorFollowersCount", pageRes.followersCount());
                    matched.put("source", "META_BUSINESS_DISCOVERY");
                    return matched;
                }
            }
            afterCursor = pageRes.afterCursor();
            if (afterCursor == null || afterCursor.isBlank()) {
                return null;
            }
        }
        return null;
    }

    private String extractAfterCursor(Map<?, ?> mediaWrapper) {
        if (mediaWrapper.get("paging") instanceof Map<?, ?> paging
                && paging.get("cursors") instanceof Map<?, ?> cursors) {
            String after = asString(cursors.get("after"));
            return (!after.isEmpty() && CURSOR_PATTERN.matcher(after).matches()) ? after : null;
        }
        return null;
    }

    private static boolean isVideoOrReelType(String mediaType) {
        if (mediaType == null || mediaType.isBlank()) return true;
        String upper = mediaType.toUpperCase(Locale.ROOT);
        return upper.contains("REEL") || upper.contains("VIDEO");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Long> fetchInsightMetricsSafe(String baseUrl, String igMediaId, String token, String mediaType) {
        String[] metricSets = isVideoOrReelType(mediaType)
                ? new String[]{
                        "views,reach,saved,shares,total_interactions,likes,comments,ig_reels_avg_watch_time",
                        "views,reach,saved,shares,total_interactions,likes,comments",
                        "views,reach,saved,shares,total_interactions",
                        "views,likes,comments",
                        "views"
                }
                : new String[]{
                        "views,reach,saved,shares,total_interactions,likes,comments",
                        "views,reach,saved,shares,total_interactions",
                        "views,likes,comments",
                        "views"
                };

        for (String metrics : metricSets) {
            try {
                Map<String, Object> resp = executeGraphGet(
                        baseUrl,
                        "/" + igMediaId + "/insights",
                        Map.of("metric", metrics),
                        token,
                        igMediaId
                );
                if (resp.get("data") instanceof List<?> dataList) {
                    Map<String, Long> parsed = new LinkedHashMap<>();
                    for (Object rowObj : dataList) {
                        if (rowObj instanceof Map<?, ?> row && row.get("name") instanceof String name) {
                            long val = 0L;
                            if (row.get("total_value") instanceof Map<?, ?> tv && tv.get("value") != null) {
                                val = asFlexibleLong(tv.get("value"));
                            } else if (row.get("values") instanceof List<?> vals && !vals.isEmpty() && vals.get(0) instanceof Map<?, ?> first) {
                                val = asFlexibleLong(first.get("value"));
                            }
                            parsed.put(name, val);
                        }
                    }
                    if (!parsed.isEmpty()) return parsed;
                }
            } catch (Exception ex) {
                log.debug("Meta insights call ({}) fallback for {}: {}", metrics, igMediaId, ex.getMessage());
                if (ex.getMessage() != null && ex.getMessage().contains("rate limit")) {
                    break;
                }
            }
        }
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeGraphGet(String baseUrl, String path, Map<String, String> params, String accessToken, String contextLabel) {
        if (Instant.now().isBefore(rateLimitCooldownUntil)) {
            throw new IllegalStateException("Meta Instagram API rate limit reached. Showing cached metrics; please try again in a minute.");
        }
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(baseUrl + path);
        params.forEach(builder::queryParam);
        builder.queryParam("access_token", accessToken);
        String proof = computeAppSecretProof(accessToken);
        if (proof != null) {
            builder.queryParam("appsecret_proof", proof);
        }
        URI uri = builder.build().encode().toUri();
        try {
            Map<String, Object> body = restClient.get().uri(uri).retrieve().body(Map.class);
            return body != null ? body : Map.of();
        } catch (RestClientResponseException ex) {
            String errBody = ex.getResponseBodyAsString();
            int status = ex.getStatusCode().value();
            if (status == 429
                    || errBody.contains("\"code\":4")
                    || errBody.contains("\"code\":17")
                    || errBody.contains("\"code\":32")
                    || errBody.contains("\"code\":613")
                    || errBody.toLowerCase(Locale.ROOT).contains("request limit reached")) {
                rateLimitCooldownUntil = Instant.now().plusSeconds(60);
                log.warn("Meta Graph API rate limit encountered on {} (HTTP {}), backing off 60s", path, status);
                throw new IllegalStateException("Meta Instagram API rate limit reached. Showing cached metrics; please try again in a minute.");
            }
            if (errBody.contains("2207013") || errBody.contains("Cannot find user") || errBody.contains("Invalid user id")) {
                throw new IllegalArgumentException("Instagram account '@" + contextLabel + "' was not found or is not a public Creator/Business account.");
            }
            if (errBody.contains("\"code\":190") || status == 401) {
                throw new IllegalStateException("Instagram Graph API access token is invalid or expired.");
            }
            if (errBody.contains("view_count")) {
                throw new IllegalStateException("Meta Graph API unsupported field: view_count");
            }
            log.warn("Meta Graph API error on path {} (HTTP {})", path, status);
            throw new IllegalStateException("Meta Graph API request failed (HTTP " + status + ").");
        } catch (RestClientException ex) {
            log.warn("Meta Graph API transport error on path {}: {}", path, ex.getClass().getSimpleName());
            throw new IllegalStateException("Meta Graph API could not be reached right now.");
        }
    }

    private void applyProfileFieldsToCreator(Creator creator, Map<String, Object> profile) {
        String name = asString(profile.get("name"));
        if (!name.isEmpty()) creator.setName(name);
        String username = asString(profile.get("username"));
        if (!username.isEmpty()) {
            creator.setHandle("@" + username);
            creator.setProfileUrl("https://www.instagram.com/" + username + "/");
        }
        String igId = asString(profile.get("igUserId"), asString(profile.get("user_id")));
        if (!igId.isEmpty()) creator.setIgUserId(igId);
        String avatar = asString(profile.get("avatarUrl"), asString(profile.get("profile_picture_url")));
        if (!avatar.isEmpty()) creator.setAvatarUrl(avatar);
        String bio = asString(profile.get("bio"), asString(profile.get("biography")));
        if (!bio.isEmpty()) creator.setBio(bio);
        String website = asString(profile.get("website"));
        if (!website.isEmpty()) creator.setWebsite(website);
        String accountType = asString(profile.get("accountType"), asString(profile.get("account_type")));
        if (!accountType.isEmpty()) creator.setAccountType(accountType);

        long followers = asLong(profile.get("followersCount"), asLong(profile.get("followers_count")));
        long follows = asLong(profile.get("followsCount"), asLong(profile.get("follows_count")));
        long mediaCount = asLong(profile.get("mediaCount"), asLong(profile.get("media_count")));
        if (followers > 0) {
            creator.setFollowersCount(followers);
            creator.setFollowersDisplay(formatCompactNumber(followers));
        }
        if (follows > 0) creator.setFollowsCount(follows);
        if (mediaCount > 0) creator.setMediaCount(mediaCount);
        creator.setLastSyncedAt(Instant.now());
    }

    private static String resolveDisplayMediaType(Map<String, Object> m) {
        String product = asString(m.get("mediaProductType"));
        String media = asString(m.get("mediaType"));
        if ("REELS".equalsIgnoreCase(product)) return "REELS";
        if (!media.isEmpty()) return media;
        return product;
    }

    private void applyReelMetrics(ReelDeliverable reel, Map<String, Object> m, long creatorFollowers, String source) {
        String mediaId = asString(m.get("id"));
        if (!mediaId.isEmpty()) reel.setIgMediaId(mediaId);
        String thumb = asString(m.get("thumbnailUrl"), asString(m.get("mediaUrl")));
        if (!thumb.isEmpty()) reel.setThumbnailUrl(thumb);
        String caption = asString(m.get("caption"));
        if (!caption.isEmpty()) {
            reel.setCaption(caption.length() > 1900 ? caption.substring(0, 1900) : caption);
        }
        String mediaType = resolveDisplayMediaType(m);
        if (!mediaType.isEmpty()) reel.setMediaType(mediaType);
        String ts = asString(m.get("timestamp"));
        if (!ts.isEmpty()) {
            try {
                reel.setPublishedAt(Instant.parse(ts.replace("+0000", "Z")));
            } catch (Exception ignored) {}
        }

        long likes = asFlexibleLong(m.get("likeCount"));
        if (likes == 0) likes = asFlexibleLong(m.get("like_count"));
        long comments = asFlexibleLong(m.get("commentsCount"));
        if (comments == 0) comments = asFlexibleLong(m.get("comments_count"));
        long views = asFlexibleLong(m.get("viewsCount"));
        boolean viewsSupported = !Boolean.FALSE.equals(m.get("viewsFieldSupported"));
        boolean hasExplicitLikes = Boolean.TRUE.equals(m.get("hasExplicitLikes")) || likes > 0;

        long reach = asFlexibleLong(m.get("reachCount"));
        long saves = asFlexibleLong(m.get("savesCount"));
        long shares = asFlexibleLong(m.get("sharesCount"));
        long avgWatchMs = asFlexibleLong(m.get("avgWatchTimeMs"));

        if (hasExplicitLikes || "META_GRAPH_INSIGHTS".equals(source)) {
            reel.setLikesCount(likes);
        }
        reel.setCommentsCount(comments);
        if (views > 0 || (viewsSupported && reel.getViewsCount() == 0)) {
            reel.setViewsCount(views);
        }
        reel.setReachCount(reach);
        reel.setSavesCount(saves);
        reel.setSharesCount(shares);
        reel.setAvgWatchTimeMs(avgWatchMs);
        reel.setTotalViewTimeMs(0L);

        long effectiveViews = reel.getViewsCount();
        long denom = effectiveViews > 0 ? effectiveViews : creatorFollowers;
        if (denom > 0) {
            double eng = Math.round(((reel.getLikesCount() + reel.getCommentsCount()) * 100.0 / denom) * 100.0) / 100.0;
            reel.setEngagementRate(eng);
        }
        reel.setStatus("VERIFIED");
        reel.setMetricsSource(source);
        reel.setSyncedAt(Instant.now());
    }

    private List<Map<String, Object>> parseMediaList(Object mediaWrapper, boolean viewsSupported) {
        if (mediaWrapper instanceof Map<?, ?> mediaMap) {
            return parseMediaDataArray(mediaMap.get("data"), viewsSupported);
        }
        return List.of();
    }

    private List<Map<String, Object>> parseMediaDataArray(Object dataObj, boolean viewsSupported) {
        if (!(dataObj instanceof List<?> list)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object itemObj : list) {
            if (itemObj instanceof Map<?, ?> m) {
                out.add(normalizeMediaMap(m, viewsSupported));
            }
        }
        return out;
    }

    private Map<String, Object> normalizeMediaMap(Map<?, ?> m, boolean viewsSupported) {
        Map<String, Object> out = new LinkedHashMap<>();
        String permalink = asString(m.get("permalink"));
        String mediaType = asString(m.get("media_type"));
        String mediaProductType = asString(m.get("media_product_type"));
        String mediaUrl = asString(m.get("media_url"));
        String rawThumb = asString(m.get("thumbnail_url"));
        String thumb = !rawThumb.isEmpty() ? rawThumb : ("VIDEO".equalsIgnoreCase(mediaType) ? "" : mediaUrl);
        long views = asFlexibleLong(m.get("view_count"));
        if (views == 0) views = asFlexibleLong(m.get("viewsCount"));
        long likes = asFlexibleLong(m.get("like_count"));
        long comments = asFlexibleLong(m.get("comments_count"));
        boolean isReel = "REELS".equalsIgnoreCase(mediaProductType)
                || permalink.toLowerCase(Locale.ROOT).contains("/reel/")
                || permalink.toLowerCase(Locale.ROOT).contains("/reels/");

        out.put("id", asString(m.get("id")));
        out.put("shortcode", extractShortcode(permalink));
        out.put("caption", asString(m.get("caption")));
        out.put("mediaType", mediaType);
        out.put("mediaProductType", mediaProductType);
        out.put("isReel", isReel);
        out.put("permalink", permalink);
        out.put("thumbnailUrl", thumb);
        out.put("mediaUrl", mediaUrl);
        out.put("timestamp", asString(m.get("timestamp")));
        out.put("likeCount", likes);
        out.put("commentsCount", comments);
        out.put("viewsCount", views);
        out.put("viewsFieldSupported", viewsSupported);
        out.put("hasExplicitLikes", m.containsKey("like_count"));
        return out;
    }

    private boolean matchesShortcode(Map<String, Object> m, String shortcode) {
        String sc = asString(m.get("shortcode"));
        if (shortcode.equals(sc)) {
            return true;
        }
        String permalink = asString(m.get("permalink"));
        String extracted = extractShortcode(permalink);
        return shortcode.equals(extracted);
    }

    private static String asString(Object v) {
        return v != null ? String.valueOf(v).trim() : "";
    }

    private static String asString(Object v, String fallback) {
        String s = asString(v);
        return s.isEmpty() ? (fallback != null ? fallback : "") : s;
    }

    private static long asLong(Object v) {
        return v instanceof Number n ? n.longValue() : 0L;
    }

    private static long asLong(Object v, long fallback) {
        return v instanceof Number n ? n.longValue() : fallback;
    }

    private static long asFlexibleLong(Object v) {
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s && !s.isBlank()) {
            try {
                return Long.parseLong(s.trim());
            } catch (NumberFormatException ignored) {}
        }
        return 0L;
    }

    private static double asDouble(Object v) {
        return v instanceof Number n ? n.doubleValue() : 0.0;
    }

    public static String extractManagementHandle(String bio) {
        if (bio == null || bio.isBlank()) return "";
        Matcher m = BIO_MGMT_PATTERN.matcher(bio);
        return m.find() ? normalizeHandle(m.group(1)) : "";
    }

    public Map<String, Object> analyzeRecentMediaSignals(List<Map<String, Object>> recentMedia, String ownerUsername, long followers) {
        Instant cutoff28 = Instant.now().minus(28, ChronoUnit.DAYS);
        Instant cutoff30 = Instant.now().minus(30, ChronoUnit.DAYS);

        boolean postedLast28Days = false;
        long interactions30d = 0L;
        long totalInteractions = 0L;
        long views30d = 0L;
        long totalViews = 0L;
        int brandedCount = 0;
        Set<String> partnerHandles = new LinkedHashSet<>();

        for (Map<String, Object> item : recentMedia) {
            long itemInteractions = asLong(item.get("likeCount")) + asLong(item.get("commentsCount"));
            long itemViews = asLong(item.get("viewsCount"));
            totalInteractions += itemInteractions;
            totalViews += itemViews;

            String ts = asString(item.get("timestamp"));
            if (!ts.isEmpty()) {
                try {
                    Instant published = Instant.parse(ts.replace("+0000", "Z"));
                    if (!published.isBefore(cutoff28)) postedLast28Days = true;
                    if (!published.isBefore(cutoff30)) {
                        interactions30d += itemInteractions;
                        views30d += itemViews;
                    }
                } catch (Exception ignored) {}
            }

            String caption = asString(item.get("caption"));
            if (!caption.isEmpty() && BRANDED_CAPTION_PATTERN.matcher(caption).find()) {
                brandedCount++;
                Matcher mm = MENTION_PATTERN.matcher(caption);
                while (mm.find()) {
                    String candidate = mm.group(1).toLowerCase();
                    if (!candidate.equalsIgnoreCase(ownerUsername)) {
                        partnerHandles.add("@" + candidate);
                    }
                }
            }
        }

        double estEngRate = 0.0;
        if (followers > 0 && !recentMedia.isEmpty()) {
            double avgPerPost = (double) totalInteractions / recentMedia.size();
            estEngRate = Math.round((avgPerPost * 100.0 / followers) * 10.0) / 10.0;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("postedLast28Days", postedLast28Days);
        out.put("publicInteractions30d", interactions30d);
        out.put("totalRecentInteractions", totalInteractions);
        out.put("publicViews30d", views30d);
        out.put("totalRecentViews", totalViews);
        out.put("estimatedInteractionRate", estEngRate);
        out.put("partnershipAdCount", brandedCount);
        out.put("detectedBrandPartners", new ArrayList<>(partnerHandles));
        return out;
    }

    @SuppressWarnings("unchecked")
    private void fetchAndApplyOAuthAccountInsights(Creator creator) {
        fetchAndApplyAccountInsights(creator, "/me", properties.getGraphBaseUrl(), creator.getIgAccessToken(), true);
    }

    @SuppressWarnings("unchecked")
    private void fetchAndApplyAccountInsights(Creator creator, String baseNodePath, String baseUrl, String token, boolean includeRecentMedia) {
        if (token == null || token.isBlank()) return;

        long interactions = 0L;
        long views = 0L;
        long reach = 0L;

        String[][] queries = {
                {"total_interactions,views,reach", "day", "total_value", "last_30_days"},
                {"views,reach", "days_28", "", ""}
        };

        for (String[] q : queries) {
            try {
                Map<String, String> params = new LinkedHashMap<>();
                params.put("metric", q[0]);
                params.put("period", q[1]);
                if (!q[2].isEmpty()) params.put("metric_type", q[2]);
                if (!q[3].isEmpty()) params.put("timeframe", q[3]);

                Map<String, Object> resp = executeGraphGet(baseUrl, baseNodePath + "/insights", params, token, creator.getHandle());
                Map<String, Long> parsed = parseAccountInsightValues(resp);
                if (!parsed.isEmpty()) {
                    if (parsed.getOrDefault("total_interactions", 0L) > 0) interactions = parsed.get("total_interactions");
                    if (parsed.getOrDefault("views", 0L) > 0) views = parsed.get("views");
                    if (parsed.getOrDefault("reach", 0L) > 0) reach = parsed.get("reach");
                    break;
                }
            } catch (Exception ex) {
                log.debug("Account /insights fallback for {}: {}", creator.getHandle(), ex.getMessage());
            }
        }

        if (interactions > 0) creator.setAccountInteractions30d(interactions);
        if (views > 0) creator.setTotalViews30d(views);
        if (reach > 0 && reach > creator.getReachCount()) creator.setReachCount(reach);

        long denom = reach > 0 ? reach : (views > 0 ? views : creator.getFollowersCount());
        if (interactions > 0 && denom > 0) {
            double rate = Math.round((interactions * 100.0 / denom) * 10.0) / 10.0;
            creator.setInteractionRate90d(rate);
            creator.setEngagementRate(rate);
        }

        String topCountries = fetchDemographicSummarySafe(baseUrl, baseNodePath, token, "country");
        if (!topCountries.isEmpty()) creator.setAudienceTopCountries(topCountries);

        String topAgeGender = fetchDemographicSummarySafe(baseUrl, baseNodePath, token, "age,gender");
        if (!topAgeGender.isEmpty()) creator.setAudienceAgeGender(topAgeGender);

        if (includeRecentMedia) {
            try {
                List<Map<String, Object>> ownMedia = fetchRecentMedia(creator.getHandle(), 25, token);
                Map<String, Object> signals = analyzeRecentMediaSignals(ownMedia, stripAt(creator.getHandle()), creator.getFollowersCount());
                creator.setPostedLast28Days(Boolean.TRUE.equals(signals.get("postedLast28Days")));
                if (asLong(signals.get("partnershipAdCount")) > creator.getPartnershipAdCount()) {
                    creator.setPartnershipAdCount((int) asLong(signals.get("partnershipAdCount")));
                }
                mergeDetectedPartners(creator, signals.get("detectedBrandPartners"));
            } catch (Exception ignored) {}
        }

        creator.setInsightsSource("CREATOR_OAUTH_INSIGHTS");
        creator.setLastSyncedAt(Instant.now());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Long> parseAccountInsightValues(Map<String, Object> resp) {
        Map<String, Long> parsed = new LinkedHashMap<>();
        if (!(resp.get("data") instanceof List<?> list)) return parsed;
        for (Object itemObj : list) {
            if (!(itemObj instanceof Map<?, ?> row)) continue;
            String name = asString(row.get("name"));
            if (name.isEmpty()) continue;
            long val = 0L;
            if (row.get("total_value") instanceof Map<?, ?> tv && tv.get("value") instanceof Number n) {
                val = n.longValue();
            } else if (row.get("values") instanceof List<?> vals) {
                for (Object vObj : vals) {
                    if (vObj instanceof Map<?, ?> vp) val += asLong(vp.get("value"));
                }
            }
            parsed.put(name, val);
        }
        return parsed;
    }

    @SuppressWarnings("unchecked")
    private String fetchDemographicSummarySafe(String baseUrl, String baseNodePath, String token, String breakdown) {
        try {
            Map<String, Object> resp = executeGraphGet(
                    baseUrl,
                    baseNodePath + "/insights",
                    Map.of(
                            "metric", "follower_demographics",
                            "period", "lifetime",
                            "metric_type", "total_value",
                            "timeframe", "last_90_days",
                            "breakdown", breakdown
                    ),
                    token,
                    "demographics"
            );
            if (!(resp.get("data") instanceof List<?> list) || list.isEmpty()) return "";
            if (!(list.get(0) instanceof Map<?, ?> metric)) return "";
            if (!(metric.get("total_value") instanceof Map<?, ?> tv)) return "";
            if (!(tv.get("breakdowns") instanceof List<?> breakdowns) || breakdowns.isEmpty()) return "";
            if (!(breakdowns.get(0) instanceof Map<?, ?> bd)) return "";
            if (!(bd.get("results") instanceof List<?> results) || results.isEmpty()) return "";

            List<Map.Entry<String, Long>> entries = new ArrayList<>();
            long total = 0L;
            for (Object rObj : results) {
                if (!(rObj instanceof Map<?, ?> r)) continue;
                long v = asLong(r.get("value"));
                total += v;
                String label = "";
                if (r.get("dimension_values") instanceof List<?> dims && !dims.isEmpty()) {
                    label = dims.stream().map(String::valueOf).reduce((a, b) -> a + " " + b).orElse("");
                }
                if (!label.isEmpty() && v > 0) entries.add(Map.entry(label, v));
            }
            if (entries.isEmpty() || total == 0) return "";
            entries.sort((a, b) -> Long.compare(b.getValue(), a.getValue()));
            final long finalTotal = total;
            return entries.stream().limit(3)
                    .map(e -> e.getKey() + " " + Math.round(e.getValue() * 100.0 / finalTotal) + "%")
                    .reduce((a, b) -> a + ", " + b)
                    .orElse("");
        } catch (Exception ex) {
            log.debug("Follower demographics ({}) unavailable: {}", breakdown, ex.getMessage());
            return "";
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchCreatorMarketplaceDataSafe(String username) {
        if (!properties.isCreatorMarketplaceEnabled() || !isBusinessDiscoveryConfigured()) {
            return Map.of();
        }
        try {
            Map<String, Object> resp = executeGraphGet(
                    properties.getBaseUrl(),
                    "/" + properties.getBusinessAccountId() + "/creator_marketplace_creators",
                    Map.of(
                            "platform", "instagram",
                            "query", username,
                            "fields", "creator_alias,creator_bio,category,verified_account,creator_age_bucket,gender,creator_countries,previous_brand_partners,insights"
                    ),
                    properties.getAccessToken(),
                    username
            );
            if (resp.get("data") instanceof List<?> list && !list.isEmpty()) {
                for (Object itemObj : list) {
                    if (itemObj instanceof Map<?, ?> row) {
                        return new LinkedHashMap<>((Map<String, Object>) row);
                    }
                }
            }
        } catch (Exception ex) {
            log.debug("Creator Discovery API lookup unavailable for {}: {}", username, ex.getMessage());
        }
        return Map.of();
    }

    /**
     * Computes real Hook Rate % = (3-second video_view actions / impressions) * 100
     * from Meta Ads Insights (requires ads_read) for any active Partnership Ads
     * linked to the creator's Instagram account or Reels.
     */
    @SuppressWarnings("unchecked")
    void fetchAndApplyPartnershipAdHookRateSafe(Creator creator, List<Map<String, Object>> recentMedia) {
        if (!isTokenConfigured()) return;
        try {
            Map<String, Object> accountsResp = executeGraphGet(
                    properties.getBaseUrl(),
                    "/me/adaccounts",
                    Map.of("fields", "id,account_status", "limit", "10"),
                    properties.getAccessToken(),
                    "adaccounts"
            );
            if (!(accountsResp.get("data") instanceof List<?> accounts) || accounts.isEmpty()) return;

            Set<String> creatorMediaIds = new HashSet<>();
            Set<String> creatorShortcodes = new HashSet<>();
            for (Map<String, Object> m : recentMedia) {
                String id = asString(m.get("id"));
                String sc = asString(m.get("shortcode"));
                if (!id.isEmpty()) creatorMediaIds.add(id);
                if (!sc.isEmpty()) creatorShortcodes.add(sc);
            }
            String creatorIgId = asString(creator.getIgUserId());
            String creatorUsername = stripAt(creator.getHandle());

            long total3sViews = 0L;
            long totalImpressions = 0L;
            int matchedAds = 0;

            for (Object accObj : accounts) {
                if (!(accObj instanceof Map<?, ?> acc)) continue;
                String actId = asString(acc.get("id"));
                if (actId.isEmpty() || !GRAPH_ID_PATTERN.matcher(actId).matches()) continue;

                Map<String, Object> adsResp = executeGraphGet(
                        properties.getBaseUrl(),
                        "/" + actId + "/ads",
                        Map.of(
                                "fields", "id,creative{instagram_permalink_url,effective_instagram_media_id,instagram_user_id},insights.date_preset(last_90d){impressions,actions}",
                                "limit", "50"
                        ),
                        properties.getAccessToken(),
                        actId
                );
                if (!(adsResp.get("data") instanceof List<?> ads)) continue;

                for (Object adObj : ads) {
                    if (!(adObj instanceof Map<?, ?> ad)) continue;
                    if (!adMatchesCreator(ad.get("creative"), creatorIgId, creatorUsername, creatorMediaIds, creatorShortcodes)) {
                        continue;
                    }
                    if (!(ad.get("insights") instanceof Map<?, ?> insWrapper)) continue;
                    if (!(insWrapper.get("data") instanceof List<?> insRows) || insRows.isEmpty()) continue;
                    if (!(insRows.get(0) instanceof Map<?, ?> row)) continue;

                    long impr = asFlexibleLong(row.get("impressions"));
                    long views3s = extract3SecondVideoViews(row.get("actions"));
                    if (impr > 0 && views3s > 0) {
                        totalImpressions += impr;
                        total3sViews += views3s;
                        matchedAds++;
                    }
                }
            }

            if (totalImpressions > 0 && total3sViews > 0) {
                double hookRate = Math.min(100.0, Math.round((total3sViews * 100.0 / totalImpressions) * 10.0) / 10.0);
                creator.setHookRate90d(hookRate);
                if (matchedAds > creator.getPartnershipAdCount()) {
                    creator.setPartnershipAdCount(matchedAds);
                }
            }
        } catch (Exception ex) {
            log.debug("Partnership Ads hook_rate lookup skipped for {}: {}", creator.getHandle(), ex.getMessage());
        }
    }

    private boolean adMatchesCreator(
            Object creativeObj,
            String creatorIgId,
            String creatorUsername,
            Set<String> mediaIds,
            Set<String> shortcodes) {
        if (!(creativeObj instanceof Map<?, ?> creative)) return false;
        String igActor = asString(creative.get("instagram_user_id"));
        String mediaId = asString(creative.get("effective_instagram_media_id"));
        String permalink = asString(creative.get("instagram_permalink_url"));

        if (!creatorIgId.isEmpty() && creatorIgId.equals(igActor)) return true;
        if (!mediaId.isEmpty() && mediaIds.contains(mediaId)) return true;
        if (!permalink.isEmpty()) {
            String sc = extractShortcode(permalink);
            if (sc != null && shortcodes.contains(sc)) return true;
            if (sc != null && !creatorUsername.isEmpty() && permalink.toLowerCase(Locale.ROOT).contains("/" + creatorUsername + "/")) return true;
        }
        return false;
    }

    private long extract3SecondVideoViews(Object actionsObj) {
        if (!(actionsObj instanceof List<?> actions)) return 0L;
        for (Object actObj : actions) {
            if (!(actObj instanceof Map<?, ?> act)) continue;
            String type = asString(act.get("action_type"));
            if ("video_view".equals(type)) {
                return asFlexibleLong(act.get("value"));
            }
        }
        return 0L;
    }

    @SuppressWarnings("unchecked")
    private void applyDiscoveredSignalsToCreator(Creator creator, Map<String, Object> profile) {
        String mgmt = asString(profile.get("suggestedManagementHandle"));
        if (!mgmt.isEmpty() && creator.getManagementHandle().isEmpty()) {
            creator.setManagementHandle(mgmt);
        }
        applyAnalyzedSignalsToCreator(creator, profile);

        if (profile.get("marketplaceInsights") instanceof Map<?, ?> mp && !mp.isEmpty()) {
            applyMarketplaceFieldsToCreator(creator, (Map<String, Object>) mp);
            return;
        }
        if ("PENDING_META_SYNC".equals(creator.getInsightsSource())) {
            creator.setInsightsSource("BUSINESS_DISCOVERY_PARTIAL");
        }
        if (!"CREATOR_OAUTH_INSIGHTS".equals(creator.getInsightsSource())
                && !"META_CREATOR_MARKETPLACE".equals(creator.getInsightsSource())
                && creator.getAuditedReelsCount() == 0) {
            long pubViews = asFlexibleLong(profile.get("publicViews30d"));
            if (pubViews == 0) pubViews = asFlexibleLong(profile.get("totalRecentViews"));
            long pubInter = asFlexibleLong(profile.get("publicInteractions30d"));
            if (pubInter == 0) pubInter = asFlexibleLong(profile.get("totalRecentInteractions"));
            double estIr = asDouble(profile.get("estimatedInteractionRate"));
            if (creator.getTotalViews30d() == 0 && pubViews > 0) creator.setTotalViews30d(pubViews);
            if (creator.getAccountInteractions30d() == 0 && pubInter > 0) creator.setAccountInteractions30d(pubInter);
            if (creator.getInteractionRate90d() == 0 && estIr > 0) creator.setInteractionRate90d(estIr);
            if (creator.getEngagementRate() == 0 && estIr > 0) creator.setEngagementRate(estIr);
        }
    }

    public void applyRecentMediaSignalsToCreator(Creator creator, List<Map<String, Object>> recentMedia) {
        Map<String, Object> signals = analyzeRecentMediaSignals(recentMedia, stripAt(creator.getHandle()), creator.getFollowersCount());
        applyAnalyzedSignalsToCreator(creator, signals);
        if ("PENDING_META_SYNC".equals(creator.getInsightsSource())) {
            creator.setInsightsSource("BUSINESS_DISCOVERY_PARTIAL");
        }
        evaluateCreatorQualification(creator);
    }

    private void applyAnalyzedSignalsToCreator(Creator creator, Map<String, Object> signals) {
        if (signals.get("postedLast28Days") instanceof Boolean p28) {
            creator.setPostedLast28Days(p28);
        }
        int ads = (int) asLong(signals.get("partnershipAdCount"));
        if (ads > creator.getPartnershipAdCount()) {
            creator.setPartnershipAdCount(ads);
        }
        mergeDetectedPartners(creator, signals.get("detectedBrandPartners"));
    }

    @SuppressWarnings("unchecked")
    private void applyMarketplaceFieldsToCreator(Creator creator, Map<String, Object> mp) {
        if (mp.get("verified_account") instanceof Boolean v) creator.setVerified(v);
        String cat = asString(mp.get("category"));
        if (!cat.isEmpty()) creator.setCategory(cat);
        String gender = asString(mp.get("gender"));
        if (!gender.isEmpty()) creator.setGender(gender);
        String age = asString(mp.get("creator_age_bucket"));
        if (!age.isEmpty()) creator.setAgeBracket(age);
        if (mp.get("creator_countries") instanceof List<?> countries && !countries.isEmpty()) {
            creator.setCountry(String.valueOf(countries.get(0)));
        }
        mergeDetectedPartners(creator, mp.get("previous_brand_partners"));

        if (mp.get("insights") instanceof Map<?, ?> ins) {
            long views = asLong(ins.get("total_views"));
            long inter = asLong(ins.get("account_interactions"));
            double ir = asDouble(ins.get("interaction_rate"));
            double hr = asDouble(ins.get("hook_rate"));
            if (views > 0) creator.setTotalViews30d(views);
            if (inter > 0) creator.setAccountInteractions30d(inter);
            if (ir > 0) creator.setInteractionRate90d(ir);
            if (hr > 0) creator.setHookRate90d(hr);
            String perf = asString(ins.get("predicted_ad_performance"));
            if (!perf.isEmpty()) creator.setPredictedAdPerformance(perf.toUpperCase(Locale.ROOT));
        }
        creator.setInsightsSource("META_CREATOR_MARKETPLACE");
    }

    private void mergeDetectedPartners(Creator creator, Object partnersObj) {
        if (!(partnersObj instanceof Collection<?> items) || items.isEmpty()) return;
        Set<String> merged = new LinkedHashSet<>();
        for (String existing : creator.getPreviousBrandPartners().split(",")) {
            if (!existing.isBlank()) merged.add(existing.trim());
        }
        for (Object item : items) {
            String s = asString(item);
            if (!s.isEmpty()) merged.add(s);
        }
        creator.setPreviousBrandPartners(String.join(", ", merged));
    }

    private boolean isHighInteractionRate(Creator creator) {
        double ir = creator.getInteractionRate90d() > 0 ? creator.getInteractionRate90d() : creator.getEngagementRate();
        return creator.getFollowersCount() >= 1_000_000L ? ir >= 2.0 : ir >= 3.0;
    }

    public void evaluateCreatorQualification(Creator creator) {
        boolean strongHook = creator.getHookRate90d() >= 30.0;
        boolean highInter = isHighInteractionRate(creator);
        boolean active28 = creator.isPostedLast28Days();
        boolean hasPartnerships = creator.getPartnershipAdCount() > 0 || !creator.getPreviousBrandPartners().isEmpty();

        boolean hasSyncedMetrics = creator.getTotalViews30d() > 0
                || creator.getAccountInteractions30d() > 0
                || creator.getInteractionRate90d() > 0
                || creator.getHookRate90d() > 0;

        if (hasSyncedMetrics) {
            creator.setTopCollaborator((strongHook || highInter) && active28 && hasPartnerships);
            if ("PENDING_META_INSIGHTS".equals(creator.getPredictedAdPerformance()) || creator.getPredictedAdPerformance().isEmpty()) {
                if ((strongHook || creator.getHookRate90d() >= 25.0) && highInter && active28) {
                    creator.setPredictedAdPerformance("HIGH");
                } else if (creator.getInteractionRate90d() > 0 || creator.getTotalViews30d() > 0) {
                    creator.setPredictedAdPerformance("MEDIUM");
                }
            }
        }
    }

    public static String computeFollowerTier(long followers) {
        if (followers >= 1_000_000L) return "Mega";
        if (followers >= 500_000L) return "Macro";
        if (followers >= 100_000L) return "Mid-Tier";
        if (followers >= 10_000L) return "Micro";
        if (followers > 0L) return "Nano";
        return "—";
    }

    public Map<String, Object> buildCreatorInsightsSummary(Creator creator, List<ReelDeliverable> deliverables) {
        return buildCreatorInsightsSummary(creator, deliverables, List.of());
    }

    public Map<String, Object> buildCreatorInsightsSummary(
            Creator creator,
            List<ReelDeliverable> deliverables,
            List<Map<String, Object>> recentMedia) {
        List<ReelDeliverable> safeDeliverables = deliverables != null ? deliverables : List.of();
        List<Map<String, Object>> safeMedia = recentMedia != null ? recentMedia : List.of();

        List<String> traits = new ArrayList<>();
        if (!creator.getCreatorTraits().isBlank()) {
            for (String t : creator.getCreatorTraits().split(",")) {
                if (!t.isBlank()) traits.add(t.trim());
            }
        } else if (!creator.getPreviousBrandPartners().isBlank()) {
            traits.add("Branded content");
        }

        List<String> partners = new ArrayList<>();
        if (!creator.getPreviousBrandPartners().isBlank()) {
            for (String p : creator.getPreviousBrandPartners().split(",")) {
                if (!p.isBlank()) partners.add(p.trim());
            }
        }

        long delViews = 0L;
        long delLikes = 0L;
        long delComments = 0L;
        int delWithViews = 0;
        int staticPhotoCount = 0;
        int pricedDeliverablesCount = 0;
        Double defaultCostRate = (creator.getCostQuoted() != null && creator.getCostQuoted() > 0)
                ? creator.getCostQuoted()
                : null;
        String costMode = creator.getCostMode();
        double delCostSum = 0.0;
        for (ReelDeliverable d : safeDeliverables) {
            delViews += d.getViewsCount();
            delLikes += d.getLikesCount();
            delComments += d.getCommentsCount();
            if (d.getViewsCount() > 0) {
                delWithViews++;
            } else if ("IMAGE".equalsIgnoreCase(d.getMediaType())
                    || "CAROUSEL_ALBUM".equalsIgnoreCase(d.getMediaType())
                    || "FEED".equalsIgnoreCase(d.getMediaType())) {
                staticPhotoCount++;
            }
            Double dCost = (d.getCostQuoted() != null && d.getCostQuoted() > 0)
                    ? d.getCostQuoted()
                    : ("PER_DELIVERABLE".equals(costMode) ? defaultCostRate : null);
            if (dCost != null && dCost > 0) {
                delCostSum += dCost;
                pricedDeliverablesCount++;
            }
        }

        // Tracked Reels Insights & ROI compute strictly from the deliverables added for tracking.
        long totalViews = delViews;
        long totalLikes = delLikes;
        long totalComments = delComments;
        long totalInteractions = totalLikes + totalComments;
        int postsWithViews = delWithViews;
        int postsAnalyzed = safeDeliverables.size();
        long avgViewsPerPost = postsWithViews > 0 && totalViews > 0
                ? Math.round((double) totalViews / postsWithViews)
                : 0L;

        long followers = creator.getFollowersCount();
        double irPct = (followers > 0 && totalInteractions > 0)
                ? Math.round((totalInteractions * 100.0 / followers) * 100.0) / 100.0
                : 0.0;

        Double effectiveCost;
        if ("PER_DELIVERABLE".equals(costMode)) {
            effectiveCost = delCostSum > 0 ? Math.round(delCostSum * 100.0) / 100.0 : null;
        } else {
            effectiveCost = defaultCostRate;
        }
        Double costPer1kFollowers = (effectiveCost != null && effectiveCost > 0 && followers > 0)
                ? Math.round((effectiveCost / (followers / 1000.0)) * 100.0) / 100.0
                : null;
        Double costPerInteraction = (effectiveCost != null && effectiveCost > 0 && totalInteractions > 0)
                ? Math.round((effectiveCost / totalInteractions) * 100.0) / 100.0
                : null;
        Double costPerView = (effectiveCost != null && effectiveCost > 0 && totalViews > 0)
                ? Math.round((effectiveCost / totalViews) * 100.0) / 100.0
                : null;

        Map<String, Object> kpiSummary = new LinkedHashMap<>();
        kpiSummary.put("totalViews", totalViews);
        kpiSummary.put("totalLikes", totalLikes);
        kpiSummary.put("totalComments", totalComments);
        kpiSummary.put("totalInteractions", totalInteractions);
        kpiSummary.put("submittedDeliverables", safeDeliverables.size());
        kpiSummary.put("metricsScope", "DELIVERABLES");
        kpiSummary.put("postsAnalyzedCount", postsAnalyzed);
        kpiSummary.put("postsWithViewsCount", postsWithViews);
        kpiSummary.put("staticPhotoCount", staticPhotoCount);

        Map<String, Object> roiBenchmarks = new LinkedHashMap<>();
        roiBenchmarks.put("tier", computeFollowerTier(followers));
        roiBenchmarks.put("followersCount", followers);
        roiBenchmarks.put("followersDisplay", followers > 0 ? creator.getFollowersDisplay() : "—");
        roiBenchmarks.put("interactionRatePct", irPct);
        roiBenchmarks.put("avgViewsPerPost", avgViewsPerPost);
        roiBenchmarks.put("avgViewsPostCount", postsWithViews);
        roiBenchmarks.put("costMode", costMode);
        roiBenchmarks.put("baseRate", defaultCostRate);
        roiBenchmarks.put("pricedDeliverablesCount", pricedDeliverablesCount);
        roiBenchmarks.put("costQuoted", effectiveCost);
        roiBenchmarks.put("currency", creator.getCurrency());
        roiBenchmarks.put("costPer1kFollowers", costPer1kFollowers);
        roiBenchmarks.put("costPerInteraction", costPerInteraction);
        roiBenchmarks.put("costPerView", costPerView);

        String interactionsWindowLabel = safeDeliverables.isEmpty()
                ? "Add tracked Reels below"
                : ("Across " + safeDeliverables.size() + " tracked reel(s)");

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("totalFollowers", followers);
        overview.put("totalFollowersDisplay", followers > 0 ? creator.getFollowersDisplay() : "—");
        overview.put("accountInteractions30d", creator.getAccountInteractions30d());
        overview.put("accountInteractionsDisplay", creator.getAccountInteractions30d() > 0 ? formatCompactNumber(creator.getAccountInteractions30d()) : "—");
        overview.put("interactionsWindowLabel", interactionsWindowLabel);
        overview.put("totalViews30d", creator.getTotalViews30d());
        overview.put("totalViewsDisplay", creator.getTotalViews30d() > 0 ? formatCompactNumber(creator.getTotalViews30d()) : "—");
        overview.put("interactionRate90d", irPct > 0 ? irPct : creator.getInteractionRate90d());

        Map<String, Object> demographics = new LinkedHashMap<>();
        demographics.put("country", creator.getCountry());
        demographics.put("gender", creator.getGender());
        demographics.put("ageBracket", creator.getAgeBracket());

        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("creator", creator);
        bundle.put("deliverables", safeDeliverables);
        bundle.put("kpiSummary", kpiSummary);
        bundle.put("roiBenchmarks", roiBenchmarks);
        bundle.put("insightsOverview", overview);
        bundle.put("demographics", demographics);
        bundle.put("traits", traits);
        bundle.put("previousBrandPartners", partners);
        bundle.put("metaConfigured", isBusinessDiscoveryConfigured() || creator.isIgConnected());
        return bundle;
    }

    public boolean backfillDeliverableFromMedia(ReelDeliverable reel, Map<String, Object> m, long creatorFollowers) {
        if (reel == null || m == null) return false;
        long mViews = asFlexibleLong(m.get("viewsCount"));
        long mLikes = asFlexibleLong(m.get("likeCount"));
        if (mLikes == 0) mLikes = asFlexibleLong(m.get("like_count"));
        long mComments = asFlexibleLong(m.get("commentsCount"));
        if (mComments == 0) mComments = asFlexibleLong(m.get("comments_count"));
        boolean changed = false;

        String mediaId = asString(m.get("id"));
        if (!mediaId.isEmpty() && (reel.getIgMediaId() == null || reel.getIgMediaId().isBlank())) {
            reel.setIgMediaId(mediaId);
            changed = true;
        }
        if (mViews > 0 && reel.getViewsCount() != mViews) {
            reel.setViewsCount(mViews);
            changed = true;
        }
        if (mLikes > 0 && reel.getLikesCount() != mLikes) {
            reel.setLikesCount(mLikes);
            changed = true;
        }
        if (mComments > 0 && reel.getCommentsCount() != mComments) {
            reel.setCommentsCount(mComments);
            changed = true;
        }
        String thumb = asString(m.get("thumbnailUrl"), asString(m.get("mediaUrl")));
        if (!thumb.isEmpty() && (reel.getThumbnailUrl() == null || reel.getThumbnailUrl().isBlank())) {
            reel.setThumbnailUrl(thumb);
            changed = true;
        }
        String cap = asString(m.get("caption"));
        if (!cap.isEmpty() && (reel.getCaption() == null || reel.getCaption().isBlank())) {
            reel.setCaption(cap.length() > 1900 ? cap.substring(0, 1900) : cap);
            changed = true;
        }
        String mediaType = resolveDisplayMediaType(m);
        if (!mediaType.isEmpty() && (reel.getMediaType() == null || reel.getMediaType().isBlank() || "FEED".equalsIgnoreCase(reel.getMediaType()))) {
            reel.setMediaType(mediaType);
            changed = true;
        }
        String ts = asString(m.get("timestamp"));
        if (!ts.isEmpty() && reel.getPublishedAt() == null) {
            try {
                reel.setPublishedAt(Instant.parse(ts.replace("+0000", "Z")));
                changed = true;
            } catch (Exception ignored) {}
        }
        if (!"VERIFIED".equals(reel.getStatus())) {
            reel.setStatus("VERIFIED");
            reel.setMetricsSource("META_BUSINESS_DISCOVERY");
            changed = true;
        }
        long denom = reel.getViewsCount() > 0 ? reel.getViewsCount() : creatorFollowers;
        if (denom > 0 && (changed || reel.getEngagementRate() == 0)) {
            long totalInt = reel.getLikesCount() + reel.getCommentsCount();
            double recalc = Math.round((totalInt * 100.0 / denom) * 100.0) / 100.0;
            if (reel.getEngagementRate() != recalc) {
                reel.setEngagementRate(recalc);
                changed = true;
            }
        }
        if (changed) {
            reel.setSyncedAt(Instant.now());
        }
        return changed;
    }

    public Map<String, Object> buildDeliverableInsightsSummary(ReelDeliverable reel, Creator creator) {
        return buildDeliverableInsightsSummary(reel, creator, 1);
    }

    public Map<String, Object> buildDeliverableInsightsSummary(ReelDeliverable reel, Creator creator, int totalDeliverablesCount) {
        long views = reel.getViewsCount();
        long likes = reel.getLikesCount();
        long comments = reel.getCommentsCount();
        long totalInteractions = likes + comments;

        double likeRatePct = views > 0 ? Math.round((likes * 100.0 / views) * 100.0) / 100.0 : 0.0;
        double commentRatePct = views > 0 ? Math.round((comments * 100.0 / views) * 100.0) / 100.0 : 0.0;
        double viewToFollowerPct = (creator != null && creator.getFollowersCount() > 0 && views > 0)
                ? Math.round((views * 100.0 / creator.getFollowersCount()) * 10.0) / 10.0
                : 0.0;
        double shareOfCreatorViewsPct = (creator != null && creator.getTotalViews30d() > 0 && views > 0)
                ? Math.min(100.0, Math.round((views * 100.0 / creator.getTotalViews30d()) * 10.0) / 10.0)
                : 0.0;
        double creatorAvgIr = creator != null ? creator.getInteractionRate90d() : 0.0;
        double deltaVsCreatorAvg = creatorAvgIr > 0
                ? Math.round((reel.getEngagementRate() - creatorAvgIr) * 10.0) / 10.0
                : 0.0;

        String costMode = creator != null ? creator.getCostMode() : "COLLECTIVE";
        Double effectiveCost;
        String costLabel;
        if ("PER_DELIVERABLE".equals(costMode)) {
            Double custom = (reel.getCostQuoted() != null && reel.getCostQuoted() > 0) ? reel.getCostQuoted() : null;
            Double rateFallback = (creator != null && creator.getCostQuoted() != null && creator.getCostQuoted() > 0)
                    ? creator.getCostQuoted()
                    : null;
            effectiveCost = custom != null ? custom : rateFallback;
            costLabel = custom != null
                    ? "Deliverable cost"
                    : (rateFallback != null ? "Per-deliverable rate" : "Set cost on deliverable");
        } else {
            Double fixed = (creator != null && creator.getCostQuoted() != null && creator.getCostQuoted() > 0)
                    ? creator.getCostQuoted()
                    : null;
            int splitCount = Math.max(1, totalDeliverablesCount);
            effectiveCost = fixed != null
                    ? Math.round((fixed / splitCount) * 100.0) / 100.0
                    : null;
            costLabel = fixed != null
                    ? (splitCount > 1 ? "Split across " + splitCount + " reels (Fixed)" : "Fixed creator cost")
                    : "Set fixed cost";
        }

        Double costPerView = (effectiveCost != null && effectiveCost > 0 && views > 0)
                ? Math.round((effectiveCost / views) * 100.0) / 100.0
                : null;
        Double costPerInteraction = (effectiveCost != null && effectiveCost > 0 && totalInteractions > 0)
                ? Math.round((effectiveCost / totalInteractions) * 100.0) / 100.0
                : null;

        Map<String, Object> derived = new LinkedHashMap<>();
        derived.put("totalInteractions", totalInteractions);
        derived.put("likeRatePct", likeRatePct);
        derived.put("commentRatePct", commentRatePct);
        derived.put("viewToFollowerRatioPct", viewToFollowerPct);
        derived.put("shareOfCreatorViewsPct", shareOfCreatorViewsPct);
        derived.put("engagementVsCreatorAvgPct", deltaVsCreatorAvg);
        derived.put("costMode", costMode);
        derived.put("costLabel", costLabel);
        derived.put("costQuoted", effectiveCost);
        derived.put("costPerView", costPerView);
        derived.put("costPerInteraction", costPerInteraction);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deliverable", reel);
        out.put("creator", creator);
        out.put("derived", derived);
        out.put("metaConfigured", isBusinessDiscoveryConfigured() || (creator != null && creator.isIgConnected()));
        return out;
    }

    @SuppressWarnings("unchecked")
    private <T> T runCoalesced(String key, java.util.function.Supplier<T> loader) {
        CompletableFuture<T> ownFuture = new CompletableFuture<>();
        CompletableFuture<T> existing = (CompletableFuture<T>) inFlightRequests.putIfAbsent(key, ownFuture);
        if (existing != null) {
            try {
                return existing.join();
            } catch (CompletionException ce) {
                if (ce.getCause() instanceof RuntimeException re) throw re;
                throw ce;
            }
        }
        try {
            T result = loader.get();
            ownFuture.complete(result);
            return result;
        } catch (RuntimeException ex) {
            ownFuture.completeExceptionally(ex);
            throw ex;
        } finally {
            inFlightRequests.remove(key, ownFuture);
        }
    }

    private record DiscoveryQueryResult(Map<String, Object> body, boolean viewsSupported) {}

    private record MediaPageResult(
            List<Map<String, Object>> items,
            String afterCursor,
            long followersCount,
            boolean viewsSupported) {}

    private static final class TtlCache<V> {
        private record Entry<V>(V value, Instant expiresAt) {}

        private final Duration ttl;
        private final int maxEntries;
        private final ConcurrentHashMap<String, Entry<V>> map = new ConcurrentHashMap<>();

        TtlCache(Duration ttl, int maxEntries) {
            this.ttl = ttl;
            this.maxEntries = maxEntries;
        }

        V get(String key) {
            Entry<V> e = map.get(key);
            if (e == null) return null;
            if (Instant.now().isAfter(e.expiresAt())) {
                map.remove(key, e);
                return null;
            }
            return e.value();
        }

        void put(String key, V value) {
            if (key == null || value == null) return;
            if (map.size() >= maxEntries) {
                Instant now = Instant.now();
                map.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt()));
                if (map.size() >= maxEntries) {
                    Iterator<String> it = map.keySet().iterator();
                    int toRemove = Math.max(1, map.size() / 4);
                    while (it.hasNext() && toRemove-- > 0) {
                        it.next();
                        it.remove();
                    }
                }
            }
            map.put(key, new Entry<>(value, Instant.now().plus(ttl)));
        }

        void remove(String key) {
            map.remove(key);
        }

        void removeByPrefix(String prefix) {
            map.keySet().removeIf(k -> k.startsWith(prefix));
        }
    }
}
