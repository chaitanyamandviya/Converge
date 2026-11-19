package com.converge.repository;

import com.converge.entity.Brand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BrandRepository extends JpaRepository<Brand, UUID> {
    Optional<Brand> findByCode(String code);
    List<Brand> findAllByOrderByCreatedAtDesc();
    List<Brand> findByManagerEmailIgnoreCase(String managerEmail);
}
