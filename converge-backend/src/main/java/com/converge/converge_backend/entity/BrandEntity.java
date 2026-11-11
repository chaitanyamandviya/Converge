package com.converge.converge_backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "brands")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BrandEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name; // e.g. "Aster & Co."

    private String contactEmail;

    private String primaryManagerEmail; // e.g. "jamie@aster.com"

    private String category; // e.g. "Skincare & Apparel"

    private int activeCampaignsCount;

    private double totalBudgetDeployed;

    private String status; // "ACTIVE", "PENDING_APPROVAL", "DEACTIVATED", "DELETED"

    @Column(columnDefinition = "TEXT")
    private String websiteUrl; // Optional brand website URL

    @Column(columnDefinition = "TEXT")
    private String logoUrl; // Auto-fetched or uploaded brand logo URL

    public void setActiveCampaignsCount(Integer activeCampaignsCount) {
        this.activeCampaignsCount = activeCampaignsCount != null ? activeCampaignsCount : 0;
    }

    public void setTotalBudgetDeployed(Double totalBudgetDeployed) {
        this.totalBudgetDeployed = totalBudgetDeployed != null ? totalBudgetDeployed : 0.0;
    }
}
