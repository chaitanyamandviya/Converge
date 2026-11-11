package com.converge.converge_backend.repository;

import com.converge.converge_backend.entity.CreatorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CreatorRepository extends JpaRepository<CreatorEntity, Long> {
    Optional<CreatorEntity> findByHandle(String handle);
    Optional<CreatorEntity> findByHandleIgnoreCase(String handle);
    List<CreatorEntity> findByAgencyName(String agencyName);
    List<CreatorEntity> findByAgencyNameIgnoreCase(String agencyName);
}
