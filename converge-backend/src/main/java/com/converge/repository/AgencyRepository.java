package com.converge.repository;

import com.converge.entity.Agency;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AgencyRepository extends JpaRepository<Agency, UUID> {
    List<Agency> findByBrandIdOrderByConnectedAtDesc(UUID brandId);
    List<Agency> findByBrandIdAndNameIgnoreCase(UUID brandId, String name);
    List<Agency> findByContactEmailIgnoreCase(String contactEmail);
    long countByBrandId(UUID brandId);
    void deleteByBrandId(UUID brandId);
}
