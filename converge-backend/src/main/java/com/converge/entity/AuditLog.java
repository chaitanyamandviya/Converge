package com.converge.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "v2_audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID brandId;

    @Column(name = "agency_id")
    private UUID agencyId;

    @Column(nullable = false)
    private String eventCode; // e.g., EVT-9204-QC

    @Column(nullable = false)
    private String category; // REEL_AUDIT, AGENCY_PERMISSION, CREATOR_LINK, SYSTEM

    @Column(nullable = false)
    private String title;

    private String statusBadge; // Verified / Compliant, Completed, Updated, Initialized

    @Column(columnDefinition = "TEXT")
    private String description;

    private String actor;
    private String metadataTag;
    private String sha256Hash;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBrandId() { return brandId; }
    public void setBrandId(UUID brandId) { this.brandId = brandId; }
    public UUID getAgencyId() { return agencyId; }
    public void setAgencyId(UUID agencyId) { this.agencyId = agencyId; }
    public String getEventCode() { return eventCode; }
    public void setEventCode(String eventCode) { this.eventCode = eventCode; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getStatusBadge() { return statusBadge; }
    public void setStatusBadge(String statusBadge) { this.statusBadge = statusBadge; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public String getMetadataTag() { return metadataTag; }
    public void setMetadataTag(String metadataTag) { this.metadataTag = metadataTag; }
    public String getSha256Hash() { return sha256Hash; }
    public void setSha256Hash(String sha256Hash) { this.sha256Hash = sha256Hash; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
