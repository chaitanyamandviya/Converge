package com.converge.repository;

import com.converge.entity.Creator;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CreatorRepository extends JpaRepository<Creator, UUID> {
    List<Creator> findByBrandIdOrderByLinkedAtDesc(UUID brandId);
    Optional<Creator> findByBrandIdAndHandleIgnoreCase(UUID brandId, String handle);
    List<Creator> findByHandleIgnoreCase(String handle);
    List<Creator> findByAgencyId(UUID agencyId);
    long countByBrandId(UUID brandId);
    void deleteByBrandId(UUID brandId);
}
