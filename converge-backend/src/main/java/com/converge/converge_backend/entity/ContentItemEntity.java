package com.converge.converge_backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "content_items", indexes = {
        @Index(name = "idx_content_items_creator_handle", columnList = "creatorHandle"),
        @Index(name = "idx_content_items_agency_name", columnList = "agencyName"),
        @Index(name = "idx_content_items_campaign_id", columnList = "campaignId"),
        @Index(name = "idx_content_items_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ContentItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String creatorHandle; // e.g. "@emma.rose"

    @Column(nullable = false)
    private String agencyName; // e.g. "North Collective"

    private Long campaignId;

    private String campaignName;

    @Column(columnDefinition = "TEXT")
    private String title; // e.g. "The everyday edit"

    @Column(columnDefinition = "TEXT")
    private String contentUrl; // e.g. "instagram.com/reel/DAx8kQ2/"

    @Column(columnDefinition = "TEXT")
    private String thumbnailUrl; // e.g. CDN thumbnail or media URL

    private String format; // "Reel", "Post", "Story"

    private String publishedDate; // e.g. "Oct 26, 2026"

    private long views;

    private long likes;

    private long comments;

    private double finalPrice;

    @Column(nullable = false)
    private String status; // "WITH_INSIGHTS", "MISSING_URL", "AWAITING_INSIGHTS"

    public void setViews(Long views) {
        this.views = views != null ? views : 0L;
    }

    public void setLikes(Long likes) {
        this.likes = likes != null ? likes : 0L;
    }

    public void setComments(Long comments) {
        this.comments = comments != null ? comments : 0L;
    }

    public void setFinalPrice(Double finalPrice) {
        this.finalPrice = finalPrice != null ? finalPrice : 0.0;
    }
}
