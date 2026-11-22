package com.converge.repository;

import com.converge.entity.CampaignCreator;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampaignCreatorRepository extends JpaRepository<CampaignCreator, UUID> {
    List<CampaignCreator> findByCampaignIdOrderByAssignedAtDesc(UUID campaignId);
    List<CampaignCreator> findByBrandId(UUID brandId);
    List<CampaignCreator> findByCreatorId(UUID creatorId);
    Optional<CampaignCreator> findByCampaignIdAndCreatorId(UUID campaignId, UUID creatorId);
    void deleteByCampaignId(UUID campaignId);
    void deleteByCreatorId(UUID creatorId);
    void deleteByBrandId(UUID brandId);
}
