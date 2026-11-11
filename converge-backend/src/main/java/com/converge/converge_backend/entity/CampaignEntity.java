package com.converge.converge_backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "campaigns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CampaignEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String brandName;

    private String status;

    private String timeframe;

    private double totalAgreedSpend;

    private long totalViews;

    private long totalLikes;

    private long totalComments;

    private int totalAgencies;

    private int totalCreators;

    private String contentWithInsights;

    @Column(columnDefinition = "TEXT")
    private String assignedAgencyNames;

    public void setTotalAgreedSpend(Double totalAgreedSpend) {
        this.totalAgreedSpend = totalAgreedSpend != null ? Math.max(0.0, totalAgreedSpend) : 0.0;
    }

    public void setTotalViews(Long totalViews) {
        this.totalViews = totalViews != null ? totalViews : 0L;
    }

    public void setTotalLikes(Long totalLikes) {
        this.totalLikes = totalLikes != null ? totalLikes : 0L;
    }

    public void setTotalComments(Long totalComments) {
        this.totalComments = totalComments != null ? totalComments : 0L;
    }

    public void setTotalAgencies(Integer totalAgencies) {
        this.totalAgencies = totalAgencies != null ? totalAgencies : 0;
    }

    public void setTotalCreators(Integer totalCreators) {
        this.totalCreators = totalCreators != null ? totalCreators : 0;
    }
}
