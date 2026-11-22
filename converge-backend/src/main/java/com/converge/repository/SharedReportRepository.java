package com.converge.repository;

import com.converge.entity.SharedReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SharedReportRepository extends JpaRepository<SharedReport, UUID> {
    Optional<SharedReport> findByShareTokenAndActiveTrue(String shareToken);
    List<SharedReport> findByBrandIdAndActiveTrueOrderByCreatedAtDesc(UUID brandId);
    void deleteByBrandId(UUID brandId);
}
