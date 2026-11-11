package com.converge.converge_backend.repository;

import com.converge.converge_backend.entity.AgencyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AgencyRepository extends JpaRepository<AgencyEntity, Long> {
    Optional<AgencyEntity> findByName(String name);
    Optional<AgencyEntity> findByContactEmail(String contactEmail);
}
