package com.converge.converge_backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "resend")
@Getter
@Setter
public class ResendProperties {
    private String apiKey = "";
    private String fromEmail = "Converge <onboarding@resend.dev>";
    private String adminEmail = "chaitanyamandviya7@gmail.com";
}
