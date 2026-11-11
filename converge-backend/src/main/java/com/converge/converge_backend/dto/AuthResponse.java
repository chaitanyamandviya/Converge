package com.converge.converge_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class AuthResponse {
    private String token;
    private String role;
    private String email;
    private Long brandId;
    private Long agencyId;
    private String status;
    private String organizationName;
    private String logoUrl;

    public AuthResponse(String token, String role, String email) {
        this.token = token;
        this.role = role;
        this.email = email;
        this.status = "ACTIVE";
    }

    public AuthResponse(String token, String role, String email, Long brandId, Long agencyId) {
        this.token = token;
        this.role = role;
        this.email = email;
        this.brandId = brandId;
        this.agencyId = agencyId;
        this.status = "ACTIVE";
    }

    public AuthResponse(String token, String role, String email, Long brandId, Long agencyId, String status, String organizationName, String logoUrl) {
        this.token = token;
        this.role = role;
        this.email = email;
        this.brandId = brandId;
        this.agencyId = agencyId;
        this.status = status != null ? status : "ACTIVE";
        this.organizationName = organizationName;
        this.logoUrl = logoUrl;
    }
}
