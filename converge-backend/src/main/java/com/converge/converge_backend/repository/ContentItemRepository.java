package com.converge.converge_backend.repository;

import com.converge.converge_backend.entity.ContentItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContentItemRepository extends JpaRepository<ContentItemEntity, Long> {
    List<ContentItemEntity> findByCreatorHandle(String creatorHandle);
    List<ContentItemEntity> findByAgencyName(String agencyName);
    List<ContentItemEntity> findByStatus(String status);
}
