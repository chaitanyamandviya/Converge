package com.converge.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Timestamped performance snapshot recorded when a Reel deliverable is added or synced
 * from Instagram so workspace views and deltas reflect genuine sync-over-sync history.
 */
@Entity
@Table(
    name = "v2_reel_snapshots",
    indexes = {
        @Index(name = "idx_reel_snapshots_deliverable_captured", columnList = "deliverableId,capturedAt"),
        @Index(name = "idx_reel_snapshots_brand_captured", columnList = "brandId,capturedAt")
    }
)
public class ReelSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID deliverableId;

    @Column(nullable = false)
    private UUID brandId;

    @Column(nullable = false)
    private UUID creatorId;

    private long viewsCount = 0;
    private long likesCount = 0;
    private long commentsCount = 0;
    private long savesCount = 0;
    private long sharesCount = 0;
    private Double hookRatePct;

    @Column(nullable = false)
    private Instant capturedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getDeliverableId() { return deliverableId; }
    public void setDeliverableId(UUID deliverableId) { this.deliverableId = deliverableId; }
    public UUID getBrandId() { return brandId; }
    public void setBrandId(UUID brandId) { this.brandId = brandId; }
    public UUID getCreatorId() { return creatorId; }
    public void setCreatorId(UUID creatorId) { this.creatorId = creatorId; }
    public long getViewsCount() { return viewsCount; }
    public void setViewsCount(long viewsCount) { this.viewsCount = viewsCount; }
    public long getLikesCount() { return likesCount; }
    public void setLikesCount(long likesCount) { this.likesCount = likesCount; }
    public long getCommentsCount() { return commentsCount; }
    public void setCommentsCount(long commentsCount) { this.commentsCount = commentsCount; }
    public long getSavesCount() { return savesCount; }
    public void setSavesCount(long savesCount) { this.savesCount = savesCount; }
    public long getSharesCount() { return sharesCount; }
    public void setSharesCount(long sharesCount) { this.sharesCount = sharesCount; }
    public Double getHookRatePct() { return hookRatePct; }
    public void setHookRatePct(Double hookRatePct) { this.hookRatePct = hookRatePct; }
    public Instant getCapturedAt() { return capturedAt; }
    public void setCapturedAt(Instant capturedAt) { this.capturedAt = capturedAt; }
}
