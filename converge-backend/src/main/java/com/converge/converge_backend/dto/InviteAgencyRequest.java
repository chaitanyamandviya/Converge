package com.converge.converge_backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InviteAgencyRequest {
    private String name;
    private String contactEmail;
    private String category;
    private String password;
    private String websiteUrl;
    private String logoUrl;
    private Long brandId;
    private String brandName;
}
