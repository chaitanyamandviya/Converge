package com.converge.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "v2_campaign_creators")
public class CampaignCreator {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID campaignId;

    @Column(nullable = false)
    private UUID brandId;

    @Column(nullable = false)
    private UUID creatorId;

    private Double agreedCost;

    private Integer expectedReels = 1;

    @Column(length = 300)
    private String notes = "";

    private Boolean demoData = false;

    @Column(nullable = false, updatable = false)
    private Instant assignedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getCampaignId() { return campaignId; }
    public void setCampaignId(UUID campaignId) { this.campaignId = campaignId; }
    public UUID getBrandId() { return brandId; }
    public void setBrandId(UUID brandId) { this.brandId = brandId; }
    public UUID getCreatorId() { return creatorId; }
    public void setCreatorId(UUID creatorId) { this.creatorId = creatorId; }
    public Double getAgreedCost() { return agreedCost; }
    public void setAgreedCost(Double agreedCost) { this.agreedCost = agreedCost; }
    public int getExpectedReels() { return expectedReels != null && expectedReels > 0 ? expectedReels : 1; }
    public void setExpectedReels(Integer expectedReels) { this.expectedReels = expectedReels != null && expectedReels > 0 ? expectedReels : 1; }
    public String getNotes() { return notes != null ? notes : ""; }
    public void setNotes(String notes) { this.notes = notes != null ? notes : ""; }
    public boolean isDemoData() { return Boolean.TRUE.equals(demoData); }
    public void setDemoData(Boolean demoData) { this.demoData = Boolean.TRUE.equals(demoData); }
    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }
}
