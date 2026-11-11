package com.converge.converge_backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthRequest {
    private String email;
    private String password;
    private String role;
    private String fullName;
    private String organizationName;
    private String category;
    private String websiteUrl;
    private Long brandId;
    private String brandName;
}
