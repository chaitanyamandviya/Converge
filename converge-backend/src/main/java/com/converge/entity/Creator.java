package com.converge.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "v2_creators")
public class Creator {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID brandId;

    private UUID agencyId;
    private String agencyName;
    private String agencyBadge;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String handle;

    private String email;

    @Column(columnDefinition = "TEXT")
    private String avatarUrl;

    @Column(columnDefinition = "TEXT")
    private String profileUrl;

    private String igUserId;
    private String accountType;
    private String website;
    private String niche = "Skincare & Beauty";

    @Column(columnDefinition = "TEXT")
    private String bio;

    private String followersDisplay = "—";
    private long followersCount = 0;
    private long followsCount = 0;
    private long mediaCount = 0;

    @Column(nullable = false)
    private String sourceType = "DIRECT"; // DIRECT, AGENCY

    private String campaignName = "";
    private long reachCount = 0;
    private int auditedReelsCount = 0;
    private double engagementRate = 0.0;

    private boolean igConnected = false;

    private Boolean verified = false;
    private String category = "";
    private String managementHandle = "";
    private String country = "";
    private String gender = "";
    private String ageBracket = "";

    @Column(columnDefinition = "TEXT")
    private String creatorTraits = "";

    @Column(columnDefinition = "TEXT")
    private String previousBrandPartners = "";

    private Integer partnershipAdCount = 0;
    private Long accountInteractions30d = 0L;
    private Long totalViews30d = 0L;
    private Double interactionRate90d = 0.0;
    private Double hookRate90d = 0.0;
    private Boolean postedLast28Days = false;
    private Boolean topCollaborator = false;
    private String predictedAdPerformance = "PENDING_META_INSIGHTS";
    private String insightsSource = "PENDING_META_SYNC";
    private String costMode = "COLLECTIVE"; // COLLECTIVE, PER_DELIVERABLE
    private Double costQuoted;
    private String currency = "INR";

    @Column(length = 500)
    private String audienceTopCountries = "";

    @Column(length = 500)
    private String audienceAgeGender = "";

    @JsonIgnore
    @Column(columnDefinition = "TEXT")
    private String igAccessToken;

    private Instant igTokenExpiresAt;
    private Instant lastSyncedAt;

    @Column(nullable = false)
    private String status = "ACTIVE_VERIFIED"; // ACTIVE_VERIFIED, PENDING

    private Boolean demoData = false;

    @Column(nullable = false, updatable = false)
    private Instant linkedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBrandId() { return brandId; }
    public void setBrandId(UUID brandId) { this.brandId = brandId; }
    public UUID getAgencyId() { return agencyId; }
    public void setAgencyId(UUID agencyId) { this.agencyId = agencyId; }
    public String getAgencyName() { return agencyName; }
    public void setAgencyName(String agencyName) { this.agencyName = agencyName; }
    public String getAgencyBadge() { return agencyBadge; }
    public void setAgencyBadge(String agencyBadge) { this.agencyBadge = agencyBadge; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getHandle() { return handle; }
    public void setHandle(String handle) { this.handle = handle; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getProfileUrl() { return profileUrl; }
    public void setProfileUrl(String profileUrl) { this.profileUrl = profileUrl; }
    public String getIgUserId() { return igUserId; }
    public void setIgUserId(String igUserId) { this.igUserId = igUserId; }
    public String getAccountType() { return accountType; }
    public void setAccountType(String accountType) { this.accountType = accountType; }
    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }
    public String getNiche() { return niche; }
    public void setNiche(String niche) { this.niche = niche; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getFollowersDisplay() { return followersDisplay; }
    public void setFollowersDisplay(String followersDisplay) { this.followersDisplay = followersDisplay; }
    public long getFollowersCount() { return followersCount; }
    public void setFollowersCount(long followersCount) { this.followersCount = followersCount; }
    public long getFollowsCount() { return followsCount; }
    public void setFollowsCount(long followsCount) { this.followsCount = followsCount; }
    public long getMediaCount() { return mediaCount; }
    public void setMediaCount(long mediaCount) { this.mediaCount = mediaCount; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public String getCampaignName() { return campaignName; }
    public void setCampaignName(String campaignName) { this.campaignName = campaignName; }
    public long getReachCount() { return reachCount; }
    public void setReachCount(long reachCount) { this.reachCount = reachCount; }
    public int getAuditedReelsCount() { return auditedReelsCount; }
    public void setAuditedReelsCount(int auditedReelsCount) { this.auditedReelsCount = auditedReelsCount; }
    public double getEngagementRate() { return engagementRate; }
    public void setEngagementRate(double engagementRate) { this.engagementRate = engagementRate; }
    public boolean isIgConnected() { return igConnected; }
    public void setIgConnected(boolean igConnected) { this.igConnected = igConnected; }
    public boolean isVerified() { return Boolean.TRUE.equals(verified); }
    public void setVerified(Boolean verified) { this.verified = Boolean.TRUE.equals(verified); }
    public String getCategory() { return category != null ? category : ""; }
    public void setCategory(String category) { this.category = category != null ? category : ""; }
    public String getManagementHandle() { return managementHandle != null ? managementHandle : ""; }
    public void setManagementHandle(String managementHandle) { this.managementHandle = managementHandle != null ? managementHandle : ""; }
    public String getCountry() { return country != null ? country : ""; }
    public void setCountry(String country) { this.country = country != null ? country : ""; }
    public String getGender() { return gender != null ? gender : ""; }
    public void setGender(String gender) { this.gender = gender != null ? gender : ""; }
    public String getAgeBracket() { return ageBracket != null ? ageBracket : ""; }
    public void setAgeBracket(String ageBracket) { this.ageBracket = ageBracket != null ? ageBracket : ""; }
    public String getCreatorTraits() { return creatorTraits != null ? creatorTraits : ""; }
    public void setCreatorTraits(String creatorTraits) { this.creatorTraits = creatorTraits != null ? creatorTraits : ""; }
    public String getPreviousBrandPartners() { return previousBrandPartners != null ? previousBrandPartners : ""; }
    public void setPreviousBrandPartners(String previousBrandPartners) { this.previousBrandPartners = previousBrandPartners != null ? previousBrandPartners : ""; }
    public int getPartnershipAdCount() { return partnershipAdCount != null ? partnershipAdCount : 0; }
    public void setPartnershipAdCount(Integer partnershipAdCount) { this.partnershipAdCount = partnershipAdCount != null ? partnershipAdCount : 0; }
    public long getAccountInteractions30d() { return accountInteractions30d != null ? accountInteractions30d : 0L; }
    public void setAccountInteractions30d(Long accountInteractions30d) { this.accountInteractions30d = accountInteractions30d != null ? accountInteractions30d : 0L; }
    public long getTotalViews30d() { return totalViews30d != null ? totalViews30d : 0L; }
    public void setTotalViews30d(Long totalViews30d) { this.totalViews30d = totalViews30d != null ? totalViews30d : 0L; }
    public double getInteractionRate90d() { return interactionRate90d != null ? interactionRate90d : 0.0; }
    public void setInteractionRate90d(Double interactionRate90d) { this.interactionRate90d = interactionRate90d != null ? interactionRate90d : 0.0; }
    public double getHookRate90d() { return hookRate90d != null ? hookRate90d : 0.0; }
    public void setHookRate90d(Double hookRate90d) { this.hookRate90d = hookRate90d != null ? hookRate90d : 0.0; }
    public boolean isPostedLast28Days() { return Boolean.TRUE.equals(postedLast28Days); }
    public void setPostedLast28Days(Boolean postedLast28Days) { this.postedLast28Days = Boolean.TRUE.equals(postedLast28Days); }
    public boolean isTopCollaborator() { return Boolean.TRUE.equals(topCollaborator); }
    public void setTopCollaborator(Boolean topCollaborator) { this.topCollaborator = Boolean.TRUE.equals(topCollaborator); }
    public String getPredictedAdPerformance() { return predictedAdPerformance != null ? predictedAdPerformance : "PENDING_META_INSIGHTS"; }
    public void setPredictedAdPerformance(String predictedAdPerformance) { this.predictedAdPerformance = predictedAdPerformance != null ? predictedAdPerformance : "PENDING_META_INSIGHTS"; }
    public String getInsightsSource() { return insightsSource != null ? insightsSource : "PENDING_META_SYNC"; }
    public void setInsightsSource(String insightsSource) { this.insightsSource = insightsSource != null ? insightsSource : "PENDING_META_SYNC"; }
    public String getCostMode() { return "PER_DELIVERABLE".equalsIgnoreCase(costMode) ? "PER_DELIVERABLE" : "COLLECTIVE"; }
    public void setCostMode(String costMode) { this.costMode = "PER_DELIVERABLE".equalsIgnoreCase(costMode) ? "PER_DELIVERABLE" : "COLLECTIVE"; }
    public Double getCostQuoted() { return costQuoted; }
    public void setCostQuoted(Double costQuoted) { this.costQuoted = costQuoted; }
    public String getCurrency() { return currency != null && !currency.isBlank() ? currency : "INR"; }
    public void setCurrency(String currency) { this.currency = currency != null && !currency.isBlank() ? currency : "INR"; }
    public String getAudienceTopCountries() { return audienceTopCountries != null ? audienceTopCountries : ""; }
    public void setAudienceTopCountries(String audienceTopCountries) { this.audienceTopCountries = audienceTopCountries != null ? audienceTopCountries : ""; }
    public String getAudienceAgeGender() { return audienceAgeGender != null ? audienceAgeGender : ""; }
    public void setAudienceAgeGender(String audienceAgeGender) { this.audienceAgeGender = audienceAgeGender != null ? audienceAgeGender : ""; }
    public String getIgAccessToken() { return igAccessToken; }
    public void setIgAccessToken(String igAccessToken) { this.igAccessToken = igAccessToken; }
    public Instant getIgTokenExpiresAt() { return igTokenExpiresAt; }
    public void setIgTokenExpiresAt(Instant igTokenExpiresAt) { this.igTokenExpiresAt = igTokenExpiresAt; }
    public Instant getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(Instant lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isDemoData() { return Boolean.TRUE.equals(demoData); }
    public void setDemoData(Boolean demoData) { this.demoData = Boolean.TRUE.equals(demoData); }
    public Instant getLinkedAt() { return linkedAt; }
    public void setLinkedAt(Instant linkedAt) { this.linkedAt = linkedAt; }
}
