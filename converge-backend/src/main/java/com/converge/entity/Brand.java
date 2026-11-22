package com.converge.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "v2_brands")
public class Brand {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code; // e.g., BRD-84920

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String slug; // e.g., @novaskincare

    private String domain;
    private String region = "North America (US & CA)";
    private String tier = "Enterprise Tier";
    private String currency = "USD ($)";
    private String locale = "en-US";

    @Column(columnDefinition = "TEXT")
    private String description;

    private String instagramHandle;
    private String contactNumber;

    @Column(nullable = false)
    private String status = "ACTIVE"; // ACTIVE, PENDING, DRAFT

    private UUID managerId;
    private String managerName;
    private String managerEmail;
    private String managerRoleTitle = "Director of Growth";

    @JsonIgnore
    private String activationToken;

    private Long targetViewsGoal;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getTier() { return tier; }
    public void setTier(String tier) { this.tier = tier; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getInstagramHandle() { return instagramHandle; }
    public void setInstagramHandle(String instagramHandle) { this.instagramHandle = instagramHandle; }
    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public UUID getManagerId() { return managerId; }
    public void setManagerId(UUID managerId) { this.managerId = managerId; }
    public String getManagerName() { return managerName; }
    public void setManagerName(String managerName) { this.managerName = managerName; }
    public String getManagerEmail() { return managerEmail; }
    public void setManagerEmail(String managerEmail) { this.managerEmail = managerEmail; }
    public String getManagerRoleTitle() { return managerRoleTitle; }
    public void setManagerRoleTitle(String managerRoleTitle) { this.managerRoleTitle = managerRoleTitle; }
    public String getActivationToken() { return activationToken; }
    public void setActivationToken(String activationToken) { this.activationToken = activationToken; }
    public Long getTargetViewsGoal() { return targetViewsGoal; }
    public void setTargetViewsGoal(Long targetViewsGoal) { this.targetViewsGoal = targetViewsGoal; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
