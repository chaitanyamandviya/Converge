package com.converge.repository;

import com.converge.entity.Campaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampaignRepository extends JpaRepository<Campaign, UUID> {
    List<Campaign> findByBrandIdOrderByCreatedAtDesc(UUID brandId);
    Optional<Campaign> findByBrandIdAndNameIgnoreCase(UUID brandId, String name);
    void deleteByBrandId(UUID brandId);
}
