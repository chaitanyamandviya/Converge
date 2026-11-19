package com.converge.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.instagram")
public class InstagramProperties {

    private String baseUrl = "https://graph.facebook.com/v26.0";
    private String graphBaseUrl = "https://graph.instagram.com/v26.0";
    private String appId = "";
    private String appSecret = "";
    private String accessToken = "";
    private String businessAccountId = "";
    private String redirectUri = "https://converge-etp.pages.dev/workspace";
    private boolean creatorMarketplaceEnabled = false;

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getGraphBaseUrl() { return graphBaseUrl; }
    public void setGraphBaseUrl(String graphBaseUrl) { this.graphBaseUrl = graphBaseUrl; }
    public String getAppId() { return appId; }
    public void setAppId(String appId) { this.appId = appId; }
    public String getAppSecret() { return appSecret; }
    public void setAppSecret(String appSecret) { this.appSecret = appSecret; }
    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
    public String getBusinessAccountId() { return businessAccountId; }
    public void setBusinessAccountId(String businessAccountId) { this.businessAccountId = businessAccountId; }
    public String getRedirectUri() { return redirectUri; }
    public void setRedirectUri(String redirectUri) { this.redirectUri = redirectUri; }
    public boolean isCreatorMarketplaceEnabled() { return creatorMarketplaceEnabled; }
    public void setCreatorMarketplaceEnabled(boolean creatorMarketplaceEnabled) { this.creatorMarketplaceEnabled = creatorMarketplaceEnabled; }
}
