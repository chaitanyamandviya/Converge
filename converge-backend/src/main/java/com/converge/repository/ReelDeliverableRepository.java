package com.converge.repository;

import com.converge.entity.ReelDeliverable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReelDeliverableRepository extends JpaRepository<ReelDeliverable, UUID> {
    List<ReelDeliverable> findByBrandIdOrderBySyncedAtDesc(UUID brandId);
    List<ReelDeliverable> findByCreatorIdOrderBySyncedAtDesc(UUID creatorId);
    Optional<ReelDeliverable> findByCreatorIdAndReelUrlIgnoreCase(UUID creatorId, String reelUrl);
    long countByBrandId(UUID brandId);
    void deleteByBrandId(UUID brandId);
}
