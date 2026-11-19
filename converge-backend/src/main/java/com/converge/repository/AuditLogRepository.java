package com.converge.repository;

import com.converge.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findByBrandIdOrderByCreatedAtDesc(UUID brandId);
    List<AuditLog> findAllByOrderByCreatedAtDesc();
    void deleteByBrandId(UUID brandId);
}
