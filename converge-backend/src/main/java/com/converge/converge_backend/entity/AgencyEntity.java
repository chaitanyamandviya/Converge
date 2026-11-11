package com.converge.converge_backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "agencies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AgencyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String contactEmail;

    @Column(nullable = false)
    private String initials;

    private int creatorCount;

    private String insightsSlots; // e.g. "16 / 20"

    private double agreedSpend; // e.g. 24000.0

    private long views;

    private long likes;

    private long comments;

    private String category = "Creator Representation";

    private String status = "ACTIVE"; // Values: ACTIVE, PENDING_APPROVAL, DEACTIVATED, DELETED

    @Column(columnDefinition = "TEXT")
    private String websiteUrl; // Optional agency website URL

    @Column(columnDefinition = "TEXT")
    private String logoUrl; // Auto-fetched or uploaded agency logo URL

    private Long brandId; // Associated Brand ID

    private String brandName; // Associated Brand Name

    public AgencyEntity(Long id, String name, String contactEmail, String initials, int creatorCount, String insightsSlots, double agreedSpend, long views, long likes, long comments) {
        this.id = id;
        this.name = name;
        this.contactEmail = contactEmail;
        this.initials = initials;
        this.creatorCount = creatorCount;
        this.insightsSlots = insightsSlots;
        this.agreedSpend = agreedSpend;
        this.views = views;
        this.likes = likes;
        this.comments = comments;
        this.category = "Creator Representation";
        this.status = "ACTIVE";
    }

    public void setCreatorCount(Integer creatorCount) {
        this.creatorCount = creatorCount != null ? creatorCount : 0;
    }

    public void setAgreedSpend(Double agreedSpend) {
        this.agreedSpend = agreedSpend != null ? agreedSpend : 0.0;
    }

    public void setViews(Long views) {
        this.views = views != null ? views : 0L;
    }

    public void setLikes(Long likes) {
        this.likes = likes != null ? likes : 0L;
    }

    public void setComments(Long comments) {
        this.comments = comments != null ? comments : 0L;
    }
}
