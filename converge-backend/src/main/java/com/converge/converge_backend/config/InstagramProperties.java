package com.converge.converge_backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "instagram.graph-api")
@Getter
@Setter
public class InstagramProperties {
    /**
     * Instagram Graph API Base URL (defaults to https://graph.facebook.com/v26.0)
     */
    private String baseUrl = "https://graph.facebook.com/v26.0";

    /**
     * Long-lived or system user access token for Instagram Graph API.
     * Can be set via environment variable: INSTAGRAM_ACCESS_TOKEN
     */
    private String accessToken = "";

    /**
     * Connected Instagram Professional / Business Account ID (e.g., 17841400000000000).
     * Can be set via environment variable: INSTAGRAM_BUSINESS_ACCOUNT_ID
     */
    private String businessAccountId = "";

    /**
     * App Secret for optional appsecret_proof hashing
     */
    private String appSecret = "";
}
