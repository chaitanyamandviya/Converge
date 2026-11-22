package com.converge.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "v2_campaigns")
public class Campaign {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID brandId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 32)
    private String status = "ACTIVE"; // PLANNING, ACTIVE, COMPLETED, DRAFT

    private Double budgetAmount;

    private Long targetViewsGoal;

    private LocalDate startDate;

    private LocalDate endDate;

    @Column(columnDefinition = "TEXT")
    private String briefNotes = "";

    @Column(length = 400)
    private String requiredHashtags;

    private Boolean requireDisclosure;

    private Boolean demoData = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBrandId() { return brandId; }
    public void setBrandId(UUID brandId) { this.brandId = brandId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getStatus() { return status != null && !status.isBlank() ? status : "ACTIVE"; }
    public void setStatus(String status) { this.status = status != null && !status.isBlank() ? status : "ACTIVE"; }
    public Double getBudgetAmount() { return budgetAmount; }
    public void setBudgetAmount(Double budgetAmount) { this.budgetAmount = budgetAmount; }
    public Long getTargetViewsGoal() { return targetViewsGoal; }
    public void setTargetViewsGoal(Long targetViewsGoal) { this.targetViewsGoal = targetViewsGoal; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public String getBriefNotes() { return briefNotes != null ? briefNotes : ""; }
    public void setBriefNotes(String briefNotes) { this.briefNotes = briefNotes != null ? briefNotes : ""; }

    public String getRequiredHashtags() { return requiredHashtags != null ? requiredHashtags : ""; }
    public void setRequiredHashtags(String requiredHashtags) { this.requiredHashtags = requiredHashtags != null ? requiredHashtags.trim() : null; }

    public boolean isRequireDisclosure() { return Boolean.TRUE.equals(requireDisclosure); }
    public Boolean getRequireDisclosure() { return requireDisclosure; }
    public void setRequireDisclosure(Boolean requireDisclosure) { this.requireDisclosure = requireDisclosure; }
    public boolean isDemoData() { return Boolean.TRUE.equals(demoData); }
    public void setDemoData(Boolean demoData) { this.demoData = Boolean.TRUE.equals(demoData); }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
