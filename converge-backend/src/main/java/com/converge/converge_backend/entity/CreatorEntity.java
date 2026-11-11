package com.converge.converge_backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "creators", indexes = {
        @Index(name = "idx_creators_agency_name", columnList = "agencyName"),
        @Index(name = "idx_creators_brand_id", columnList = "brandId"),
        @Index(name = "idx_creators_campaign_id", columnList = "campaignId"),
        @Index(name = "idx_creators_tier", columnList = "tier"),
        @Index(name = "idx_creators_handle", columnList = "handle")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreatorEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String handle; // e.g. "@emma.rose"

    @Column(nullable = false)
    private String name; // e.g. "Emma Rose"

    @Column(nullable = false)
    private String agencyName; // e.g. "North Collective"

    private String avatarInitials; // e.g. "ER"

    private String contentSlots; // e.g. "3 posts"

    private long views;

    private long likes;

    private long comments;

    private long followersCount; // e.g. 14405

    private long followsCount;   // e.g. 320

    private long mediaCount;     // e.g. 552

    private String tier;         // "Nano", "Micro", "Mid-Tier", "Macro", "Mega"

    private String creatorType;  // "Influencer", "Content Creator", "Brand"

    private int audienceFit = 5; // 1 to 5 scale

    private int contentQuality = 5; // 1 to 5 scale

    private String authenticityRisk = "Low"; // "Low", "Medium", "High"

    private double price;

    @Column(name = "min_price")
    private Double minPrice;

    @Column(name = "max_price")
    private Double maxPrice;

    @Column(name = "pricing_model")
    private String pricingModel = "PER_DELIVERABLE"; // "PER_DELIVERABLE" or "PACKAGE"

    private String platform; // "Instagram", "YouTube"

    private String category; // e.g. "Skincare & Lifestyle"

    @Column(columnDefinition = "TEXT")
    private String profileUrl;

    @Column(columnDefinition = "TEXT")
    private String avatarUrl;

    private Long campaignId;

    private String campaignName;

    private Long brandId;

    private String brandName;

    @Transient
    private java.util.List<String> contentUrls;

    public void setViews(Long views) {
        this.views = views != null ? views : 0L;
    }

    public void setLikes(Long likes) {
        this.likes = likes != null ? likes : 0L;
    }

    public void setComments(Long comments) {
        this.comments = comments != null ? comments : 0L;
    }

    public void setPrice(Double price) {
        this.price = price != null ? price : 0.0;
    }

    public void setFollowersCount(Long followersCount) {
        this.followersCount = followersCount != null ? Math.max(0, followersCount) : 0L;
        computeAutoTier();
    }

    public void setFollowsCount(Long followsCount) {
        this.followsCount = followsCount != null ? Math.max(0, followsCount) : 0L;
    }

    public void setMediaCount(Long mediaCount) {
        this.mediaCount = mediaCount != null ? Math.max(0, mediaCount) : 0L;
    }

    public void computeAutoTier() {
        if (this.tier == null || this.tier.isBlank() || "Auto".equalsIgnoreCase(this.tier)) {
            if (this.followersCount >= 1000000) {
                this.tier = "Mega";
            } else if (this.followersCount >= 500000) {
                this.tier = "Macro";
            } else if (this.followersCount >= 100000) {
                this.tier = "Mid-Tier";
            } else if (this.followersCount >= 10000) {
                this.tier = "Micro";
            } else {
                this.tier = "Nano";
            }
        }
        if (this.creatorType == null || this.creatorType.isBlank()) {
            this.creatorType = "Influencer";
        }
    }
}
