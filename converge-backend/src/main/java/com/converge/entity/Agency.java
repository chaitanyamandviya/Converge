package com.converge.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "v2_agencies")
public class Agency {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID brandId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String handle;

    private String monogram;
    private String roleBadge = "Partner Agency";

    @Column(length = 600)
    private String scopeDescription;

    private String region = "North America";
    private String contactName;
    private String contactEmail;

    private int creatorsCount = 0;
    private int auditedReelsCount = 0;

    @Column(nullable = false)
    private String status = "CONNECTED"; // CONNECTED, PENDING

    @Column(nullable = false, updatable = false)
    private Instant connectedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBrandId() { return brandId; }
    public void setBrandId(UUID brandId) { this.brandId = brandId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getHandle() { return handle; }
    public void setHandle(String handle) { this.handle = handle; }
    public String getMonogram() { return monogram; }
    public void setMonogram(String monogram) { this.monogram = monogram; }
    public String getRoleBadge() { return roleBadge; }
    public void setRoleBadge(String roleBadge) { this.roleBadge = roleBadge; }
    public String getScopeDescription() { return scopeDescription; }
    public void setScopeDescription(String scopeDescription) { this.scopeDescription = scopeDescription; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }
    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
    public int getCreatorsCount() { return creatorsCount; }
    public void setCreatorsCount(int creatorsCount) { this.creatorsCount = creatorsCount; }
    public int getAuditedReelsCount() { return auditedReelsCount; }
    public void setAuditedReelsCount(int auditedReelsCount) { this.auditedReelsCount = auditedReelsCount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getConnectedAt() { return connectedAt; }
    public void setConnectedAt(Instant connectedAt) { this.connectedAt = connectedAt; }
}
