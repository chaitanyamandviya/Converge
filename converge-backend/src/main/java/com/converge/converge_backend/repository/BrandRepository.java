package com.converge.converge_backend.repository;

import com.converge.converge_backend.entity.BrandEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BrandRepository extends JpaRepository<BrandEntity, Long> {
    Optional<BrandEntity> findByNameIgnoreCase(String name);
}
