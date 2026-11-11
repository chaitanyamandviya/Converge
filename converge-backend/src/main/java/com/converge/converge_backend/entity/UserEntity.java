package com.converge.converge_backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_users_role", columnList = "role"),
        @Index(name = "idx_users_status", columnList = "status"),
        @Index(name = "idx_users_brand_id", columnList = "brand_id"),
        @Index(name = "idx_users_agency_id", columnList = "agency_id")
})
@Getter
@Setter
@NoArgsConstructor
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String role; // Values: SYSTEM_ADMIN, BRAND_MANAGER, AGENCY_MANAGER

    private String fullName;

    private String organizationName;

    private String websiteUrl;

    @Column(columnDefinition = "TEXT")
    private String logoUrl;

    private String status = "ACTIVE"; // Values: ACTIVE, PENDING_APPROVAL

    // Optional scoping fields depending on the role
    @Column(name = "brand_id")
    private Long brandId; // Populated if role is BRAND_MANAGER

    @Column(name = "agency_id")
    private Long agencyId; // Populated if role is AGENCY_MANAGER

    @Override
    public String toString() {
        return email != null ? email : "";
    }
}
