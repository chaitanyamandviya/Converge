package com.converge.repository;

import com.converge.entity.ReelSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReelSnapshotRepository extends JpaRepository<ReelSnapshot, UUID> {
    List<ReelSnapshot> findTop14ByDeliverableIdOrderByCapturedAtDesc(UUID deliverableId);
    List<ReelSnapshot> findByBrandIdOrderByCapturedAtDesc(UUID brandId);
    Optional<ReelSnapshot> findFirstByDeliverableIdOrderByCapturedAtDesc(UUID deliverableId);
    void deleteByDeliverableId(UUID deliverableId);
    void deleteByCreatorId(UUID creatorId);
    void deleteByBrandId(UUID brandId);
}
