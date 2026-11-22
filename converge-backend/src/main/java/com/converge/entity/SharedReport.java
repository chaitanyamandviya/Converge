package com.converge.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "v2_shared_reports")
public class SharedReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID brandId;

    private UUID agencyId;

    @Column(nullable = false, unique = true, length = 128)
    private String shareToken;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(length = 80)
    private String campaignFilter = "ALL";

    private Boolean includeSpend = true;

    private String createdBy;

    private Boolean active = true;

    private Instant expiresAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBrandId() { return brandId; }
    public void setBrandId(UUID brandId) { this.brandId = brandId; }
    public UUID getAgencyId() { return agencyId; }
    public void setAgencyId(UUID agencyId) { this.agencyId = agencyId; }
    public String getShareToken() { return shareToken; }
    public void setShareToken(String shareToken) { this.shareToken = shareToken; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCampaignFilter() { return campaignFilter != null && !campaignFilter.isBlank() ? campaignFilter : "ALL"; }
    public void setCampaignFilter(String campaignFilter) { this.campaignFilter = campaignFilter != null && !campaignFilter.isBlank() ? campaignFilter : "ALL"; }
    public boolean isIncludeSpend() { return includeSpend == null || Boolean.TRUE.equals(includeSpend); }
    public void setIncludeSpend(Boolean includeSpend) { this.includeSpend = includeSpend == null || Boolean.TRUE.equals(includeSpend); }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public boolean isActive() { return active == null || Boolean.TRUE.equals(active); }
    public void setActive(Boolean active) { this.active = active == null || Boolean.TRUE.equals(active); }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
