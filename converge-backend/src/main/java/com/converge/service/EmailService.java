package com.converge.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.HtmlUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Service
public class EmailService {

    static final String DEFAULT_PRODUCTION_FRONTEND_URL = "https://converge-etp.pages.dev";
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final RestClient restClient;
    private final String apiKey;
    private final String senderEmail;
    private final String senderName;
    private final String frontendUrl;

    public EmailService(
            @Value("${app.brevo.api-key:}") String apiKey,
            @Value("${app.brevo.sender-email:noreply@converge.run.place}") String senderEmail,
            @Value("${app.brevo.sender-name:Converge}") String senderName,
            @Value("${app.frontend.url:" + DEFAULT_PRODUCTION_FRONTEND_URL + "}") String frontendUrl) {
        this.restClient = RestClient.create("https://api.brevo.com/v3");
        this.apiKey = apiKey;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
        this.frontendUrl = normalizeFrontendUrl(frontendUrl);
    }

    public static String normalizeFrontendUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            return DEFAULT_PRODUCTION_FRONTEND_URL;
        }
        String trimmed = raw.trim().replaceAll("/+$", "");
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            trimmed = "https://" + trimmed;
        }
        return trimmed;
    }

    public String buildAuthUrl(String mode, String email) {
        String safeMode = (mode != null && mode.equalsIgnoreCase("signup")) ? "signup" : "signin";
        String base = frontendUrl + "/auth?mode=" + safeMode;
        if (email == null || email.isBlank()) {
            return base;
        }
        return base + "&email=" + URLEncoder.encode(email.trim(), StandardCharsets.UTF_8);
    }

    public boolean sendBrandWelcomeEmail(String toEmail, String toName, String brandName) {
        String signInUrl = buildAuthUrl("signin", toEmail);
        String onboardUrl = buildAuthUrl("signup", toEmail);
        String logoUrl = frontendUrl + "/converge-logo.png";

        String safeBrand = HtmlUtils.htmlEscape(brandName != null ? brandName : "Brand");
        String safeName = HtmlUtils.htmlEscape(toName != null && !toName.isBlank() ? toName : "there");
        String safeEmail = HtmlUtils.htmlEscape(toEmail != null ? toEmail : "");

        String html = """
            <div style="font-family:Inter,Arial,sans-serif;background:#fbf9f5;padding:32px;color:#1f1d19;">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;border:1px solid #e4e2de;">
                <div style="margin-bottom:18px;">
                  <img src="%s" alt="Converge" width="36" height="36" style="border-radius:50%%;vertical-align:middle;" />
                  <span style="font-size:16px;font-weight:700;color:#1f1d19;vertical-align:middle;margin-left:8px;">Converge</span>
                </div>
                <h2 style="margin:0 0 8px;font-size:22px;color:#1f1d19;">Your %s Workspace is Ready</h2>
                <p style="color:#575249;font-size:15px;line-height:24px;margin:0 0 16px;">
                  Hi %s, your Converge brand workspace for <strong>%s</strong> has been created and assigned to <strong>%s</strong>.
                  Sign in with your account or complete onboarding as a new user to manage agencies and tracked creator Reels.
                </p>
                <div style="margin-top:20px;">
                  <a href="%s" style="display:inline-block;padding:12px 26px;background:#0b57d0;color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:600;font-size:14px;margin-right:8px;margin-bottom:8px;">
                    Sign In &amp; Open Workspace
                  </a>
                  <a href="%s" style="display:inline-block;padding:12px 22px;background:#f5f0e8;color:#1f1d19;text-decoration:none;border-radius:9999px;font-weight:600;font-size:14px;border:1px solid #d9d3c7;margin-bottom:8px;">
                    New User? Get Onboarded →
                  </a>
                </div>
                <p style="color:#787166;font-size:12px;line-height:18px;margin:20px 0 0;border-top:1px solid #eee9e0;padding-top:14px;">
                  Direct login: <a href="%s" style="color:#0b57d0;">%s</a><br/>
                  First-time onboarding: <a href="%s" style="color:#0b57d0;">%s</a>
                </p>
              </div>
            </div>
            """.formatted(
                logoUrl,
                safeBrand,
                safeName,
                safeBrand,
                safeEmail,
                signInUrl,
                onboardUrl,
                signInUrl,
                signInUrl,
                onboardUrl,
                onboardUrl
        );

        return sendEmail(toEmail, toName, brandName + " Workspace is Ready on Converge", html);
    }

    public boolean sendPasswordResetEmail(String toEmail, String toName) {
        String signInUrl = buildAuthUrl("signin", toEmail);
        String onboardUrl = buildAuthUrl("signup", toEmail);
        String logoUrl = frontendUrl + "/converge-logo.png";

        String safeName = HtmlUtils.htmlEscape(toName != null && !toName.isBlank() ? toName : "there");

        String html = """
            <div style="font-family:Inter,Arial,sans-serif;background:#fbf9f5;padding:32px;color:#1f1d19;">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;border:1px solid #e4e2de;">
                <div style="margin-bottom:18px;">
                  <img src="%s" alt="Converge" width="36" height="36" style="border-radius:50%%;vertical-align:middle;" />
                  <span style="font-size:16px;font-weight:700;color:#1f1d19;vertical-align:middle;margin-left:8px;">Converge</span>
                </div>
                <h2 style="margin:0 0 8px;font-size:22px;color:#1f1d19;">Sign In &amp; Account Recovery</h2>
                <p style="color:#575249;font-size:15px;line-height:24px;margin:0 0 16px;">
                  Hi %s, use the link below to access your Converge account and manage your brand workspace.
                </p>
                <div style="margin-top:20px;">
                  <a href="%s" style="display:inline-block;padding:12px 26px;background:#0b57d0;color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:600;font-size:14px;margin-right:8px;margin-bottom:8px;">
                    Return to Sign In
                  </a>
                  <a href="%s" style="display:inline-block;padding:12px 22px;background:#f5f0e8;color:#1f1d19;text-decoration:none;border-radius:9999px;font-weight:600;font-size:14px;border:1px solid #d9d3c7;margin-bottom:8px;">
                    Create Account / Onboard
                  </a>
                </div>
                <p style="color:#787166;font-size:12px;line-height:18px;margin:20px 0 0;border-top:1px solid #eee9e0;padding-top:14px;">
                  Sign-in link: <a href="%s" style="color:#0b57d0;">%s</a>
                </p>
              </div>
            </div>
            """.formatted(logoUrl, safeName, signInUrl, onboardUrl, signInUrl, signInUrl);

        return sendEmail(toEmail, toName, "Converge Account Access & Password Help", html);
    }

    private boolean sendEmail(String toEmail, String toName, String subject, String htmlContent) {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("Brevo API key not configured; skipping email to {}", toEmail);
            return false;
        }
        try {
            Map<String, Object> body = Map.of(
                    "sender", Map.of("name", senderName, "email", senderEmail),
                    "to", List.of(Map.of("email", toEmail, "name", toName != null ? toName : toEmail)),
                    "subject", subject,
                    "htmlContent", htmlContent
            );
            restClient.post()
                    .uri("/smtp/email")
                    .header("api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (Exception ex) {
            log.warn("Failed to dispatch Brevo email to {}: {}", toEmail, ex.getMessage());
            return false;
        }
    }
}
