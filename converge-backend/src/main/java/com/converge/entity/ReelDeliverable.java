package com.converge.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "v2_reel_deliverables")
public class ReelDeliverable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID brandId;

    @Column(nullable = false)
    private UUID creatorId;

    private String creatorHandle;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reelUrl;

    private String igMediaId;
    private String shortcode;
    private String mediaType;

    @Column(columnDefinition = "TEXT")
    private String caption;

    @Column(columnDefinition = "TEXT")
    private String thumbnailUrl;

    private String duration = "0:45";
    private Double costQuoted;

    private long viewsCount = 0;
    private long reachCount = 0;
    private long likesCount = 0;
    private long commentsCount = 0;
    private long savesCount = 0;
    private long sharesCount = 0;
    private Long avgWatchTimeMs = 0L;
    private Long totalViewTimeMs = 0L;
    private double engagementRate = 0.0;

    @Column(nullable = false)
    private String status = "PENDING_META_SYNC"; // VERIFIED, PENDING_META_SYNC, NOT_FOUND

    private String metricsSource = "PENDING_META_API"; // META_GRAPH_INSIGHTS, META_BUSINESS_DISCOVERY, PENDING_META_API
    private Instant publishedAt;

    @Column(nullable = false)
    private Instant syncedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBrandId() { return brandId; }
    public void setBrandId(UUID brandId) { this.brandId = brandId; }
    public UUID getCreatorId() { return creatorId; }
    public void setCreatorId(UUID creatorId) { this.creatorId = creatorId; }
    public String getCreatorHandle() { return creatorHandle; }
    public void setCreatorHandle(String creatorHandle) { this.creatorHandle = creatorHandle; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getReelUrl() { return reelUrl; }
    public void setReelUrl(String reelUrl) { this.reelUrl = reelUrl; }
    public String getIgMediaId() { return igMediaId; }
    public void setIgMediaId(String igMediaId) { this.igMediaId = igMediaId; }
    public String getShortcode() { return shortcode; }
    public void setShortcode(String shortcode) { this.shortcode = shortcode; }
    public String getMediaType() { return mediaType; }
    public void setMediaType(String mediaType) { this.mediaType = mediaType; }
    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }
    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }
    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
    public Double getCostQuoted() { return costQuoted; }
    public void setCostQuoted(Double costQuoted) { this.costQuoted = costQuoted; }
    public long getViewsCount() { return viewsCount; }
    public void setViewsCount(long viewsCount) { this.viewsCount = viewsCount; }
    public long getReachCount() { return reachCount; }
    public void setReachCount(long reachCount) { this.reachCount = reachCount; }
    public long getLikesCount() { return likesCount; }
    public void setLikesCount(long likesCount) { this.likesCount = likesCount; }
    public long getCommentsCount() { return commentsCount; }
    public void setCommentsCount(long commentsCount) { this.commentsCount = commentsCount; }
    public long getSavesCount() { return savesCount; }
    public void setSavesCount(long savesCount) { this.savesCount = savesCount; }
    public long getSharesCount() { return sharesCount; }
    public void setSharesCount(long sharesCount) { this.sharesCount = sharesCount; }
    public long getAvgWatchTimeMs() { return avgWatchTimeMs != null ? avgWatchTimeMs : 0L; }
    public void setAvgWatchTimeMs(Long avgWatchTimeMs) { this.avgWatchTimeMs = avgWatchTimeMs != null ? avgWatchTimeMs : 0L; }
    public long getTotalViewTimeMs() { return totalViewTimeMs != null ? totalViewTimeMs : 0L; }
    public void setTotalViewTimeMs(Long totalViewTimeMs) { this.totalViewTimeMs = totalViewTimeMs != null ? totalViewTimeMs : 0L; }
    public double getEngagementRate() { return engagementRate; }
    public void setEngagementRate(double engagementRate) { this.engagementRate = engagementRate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMetricsSource() { return metricsSource; }
    public void setMetricsSource(String metricsSource) { this.metricsSource = metricsSource; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    public Instant getSyncedAt() { return syncedAt; }
    public void setSyncedAt(Instant syncedAt) { this.syncedAt = syncedAt; }
}
