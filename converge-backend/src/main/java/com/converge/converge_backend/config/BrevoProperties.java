package com.converge.converge_backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "brevo")
@Getter
@Setter
public class BrevoProperties {
    private String apiKey = "";
    private String senderEmail = "chaitanyamandviya7@gmail.com";
    private String senderName = "Converge";
    private String adminEmail = "chaitanyamandviya7@gmail.com";
}
