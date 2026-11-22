package com.converge.repository;

import com.converge.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmailIgnoreCase(String email);
    List<User> findByEmailContainingIgnoreCase(String email);
    List<User> findByEmailContainingIgnoreCaseAndRoleNotIgnoreCase(String email, String role, Pageable pageable);
    boolean existsByEmailIgnoreCase(String email);
}
