package com.converge.converge_backend.service;

import com.converge.converge_backend.config.BrevoProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    private final BrevoProperties brevoProperties;
    private final RestTemplate restTemplate;
    private final Executor taskExecutor;

    @Value("${app.frontend-url:https://converge-etp.pages.dev}")
    private String frontendUrl;

    public EmailService(
            BrevoProperties brevoProperties,
            RestTemplate restTemplate,
            Executor taskExecutor) {
        this.brevoProperties = brevoProperties;
        this.restTemplate = restTemplate;
        this.taskExecutor = taskExecutor;
    }

    public boolean isConfigured() {
        String key = brevoProperties.getApiKey();
        return key != null && !key.isBlank() && !key.contains("YOUR_BREVO_API_KEY");
    }

    public void sendEmail(String to, String subject, String htmlBody, String actionUrl) {
        taskExecutor.execute(() -> dispatchEmailInternal(to, subject, htmlBody, actionUrl));
    }

    private void dispatchEmailInternal(String to, String subject, String htmlBody, String actionUrl) {
        if (!isConfigured()) {
            log.info("Brevo API key not configured — skipping email to {} [Subject: {}] [Link: {}]", to, subject, actionUrl);
            return;
        }

        String senderEmail = (brevoProperties.getSenderEmail() != null && !brevoProperties.getSenderEmail().isBlank())
                ? brevoProperties.getSenderEmail().trim()
                : resolveAdminEmail();
        String senderName = (brevoProperties.getSenderName() != null && !brevoProperties.getSenderName().isBlank())
                ? brevoProperties.getSenderName().trim()
                : "Converge";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set("api-key", brevoProperties.getApiKey().trim());

        Map<String, Object> payload = Map.of(
                "sender", Map.of("name", senderName, "email", senderEmail),
                "to", List.of(Map.of("email", to)),
                "subject", subject,
                "htmlContent", htmlBody
        );

        try {
            restTemplate.postForEntity(BREVO_API_URL, new HttpEntity<>(payload, headers), String.class);
            log.info("Delivered email via Brevo to {} [Subject: {}] [Link: {}]", to, subject, actionUrl);
        } catch (Exception ex) {
            log.warn("Brevo delivery failed for {} [Subject: {}] [Link: {}]: {}", to, subject, actionUrl, ex.getMessage());
        }
    }

    private String resolveAdminEmail() {
        return (brevoProperties.getAdminEmail() != null && !brevoProperties.getAdminEmail().isBlank())
                ? brevoProperties.getAdminEmail().trim()
                : "chaitanyamandviya7@gmail.com";
    }

    public void sendOnboardingApplicationEmails(String applicantEmail, String fullName, String orgName, String role, String websiteUrl, String approverEmail, String partnerBrandName) {
        String roleLabel = "BRAND_MANAGER".equalsIgnoreCase(role) ? "Brand Workspace" : "Partner Agency";
        String approverLabel = "BRAND_MANAGER".equalsIgnoreCase(role)
                ? "System Administrator"
                : ("Brand Manager" + (partnerBrandName != null && !partnerBrandName.isBlank() ? " (" + partnerBrandName + ")" : ""));
        String siteLine = (websiteUrl != null && !websiteUrl.isBlank()) ? "<p><strong>Website:</strong> " + websiteUrl + "</p>" : "";
        String brandLine = (partnerBrandName != null && !partnerBrandName.isBlank()) ? "<p><strong>Partner Brand:</strong> " + partnerBrandName + "</p>" : "";

        String applicantHtml = """
                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #F6F4EC; border-radius: 12px;">
                  <h2 style="margin-top:0;">Application Received — %s</h2>
                  <p>Hi %s,</p>
                  <p>Your self-onboarding application for <strong>%s</strong> (%s) has been received by Converge.</p>
                  %s
                  %s
                  <p>Your workspace is currently <strong>Pending Approval</strong> by the %s. You will receive a confirmation email as soon as your account is activated.</p>
                  <p style="font-size:12px; color:#666; margin-top:24px;">© 2026 Converge Platform</p>
                </div>
                """.formatted(orgName, fullName != null ? fullName : applicantEmail, orgName, roleLabel, brandLine, siteLine, approverLabel);

        sendEmail(applicantEmail, "Converge — Application Pending Approval (" + orgName + ")", applicantHtml, frontendUrl + "/login");

        String targetApprover = (approverEmail != null && !approverEmail.isBlank())
                ? approverEmail.trim()
                : resolveAdminEmail();

        String adminHtml = """
                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #FFFFFF; border: 1px solid #E2E0D8; border-radius: 12px;">
                  <h2 style="margin-top:0;">New %s Approval Request</h2>
                  <p><strong>Organization:</strong> %s</p>
                  <p><strong>Applicant:</strong> %s (%s)</p>
                  %s
                  %s
                  <p>Log in to your Converge dashboard at <a href="%s/login">%s/login</a> to review and click <strong>✓ Approve</strong>.</p>
                </div>
                """.formatted(roleLabel, orgName, fullName != null ? fullName : "Manager", applicantEmail, brandLine, siteLine, frontendUrl, frontendUrl);
        sendEmail(targetApprover, "Action Required: Approve " + orgName + " (" + roleLabel + ")", adminHtml, frontendUrl + "/dashboard");
    }

    public void sendApprovalConfirmationEmail(String toEmail, String orgName, String role) {
        String roleLabel = "BRAND_MANAGER".equalsIgnoreCase(role) ? "Brand Workspace" : "Agency Workspace";
        String encodedEmail = URLEncoder.encode(toEmail, StandardCharsets.UTF_8);
        String setPasswordUrl = frontendUrl + "/login?mode=forgot&email=" + encodedEmail;
        String html = """
                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #F6F4EC; border-radius: 12px;">
                  <h2 style="margin-top:0; color: #527E5A;">✓ Your %s is Approved!</h2>
                  <p>Great news — <strong>%s</strong> has been approved and activated on Converge.</p>
                  <p>You can now sign in with your registered email (<strong>%s</strong>) or set a new password below:</p>
                  <p style="margin: 20px 0;">
                    <a href="%s/login" style="display:inline-block; padding:10px 18px; background:#243F82; color:#FFFFFF; text-decoration:none; border-radius:999px; font-weight:600; margin-right: 10px;">Log in to Converge ↗</a>
                    <a href="%s" style="display:inline-block; padding:10px 18px; background:#FFFFFF; color:#243F82; border:1px solid #243F82; text-decoration:none; border-radius:999px; font-weight:600;">Set / Reset Password ↗</a>
                  </p>
                </div>
                """.formatted(roleLabel, orgName, toEmail, frontendUrl, setPasswordUrl);

        sendEmail(toEmail, "Approved: Welcome to Converge (" + orgName + ")", html, setPasswordUrl);
    }

    public void sendInvitationEmail(String toEmail, String orgName, String role) {
        String roleLabel = "BRAND_MANAGER".equalsIgnoreCase(role) ? "Brand Manager" : "Agency Manager";
        String encodedEmail = URLEncoder.encode(toEmail, StandardCharsets.UTF_8);
        String setPasswordUrl = frontendUrl + "/login?mode=forgot&email=" + encodedEmail;

        String html = """
                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #F6F4EC; border-radius: 12px;">
                  <h2 style="margin-top:0;">You've been invited to Converge</h2>
                  <p>Your <strong>%s</strong> workspace for <strong>%s</strong> has been provisioned.</p>
                  <div style="background:#FFFFFF; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #E2E0D8;">
                    <p style="margin:4px 0;"><strong>Account Email:</strong> %s</p>
                    <p style="margin:4px 0;"><strong>Role:</strong> %s</p>
                  </div>
                  <p>Click the button below to set your initial password and access your workspace:</p>
                  <p style="margin: 20px 0;">
                    <a href="%s" style="display:inline-block; padding:12px 22px; background:#243F82; color:#FFFFFF; text-decoration:none; border-radius:999px; font-weight:600;">Set Initial Password & Sign In ↗</a>
                  </p>
                </div>
                """.formatted(roleLabel, orgName, toEmail, roleLabel, setPasswordUrl);

        sendEmail(toEmail, "Invitation to join Converge — Set Password for " + orgName, html, setPasswordUrl);
    }

    public void sendPasswordResetEmail(String toEmail) {
        String encodedEmail = URLEncoder.encode(toEmail, StandardCharsets.UTF_8);
        String resetUrl = frontendUrl + "/login?mode=forgot&email=" + encodedEmail;
        String html = """
                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #F6F4EC; border-radius: 12px;">
                  <h2 style="margin-top:0;">Converge Password Updated</h2>
                  <p>The password for your Converge account (<strong>%s</strong>) has been updated.</p>
                  <p><a href="%s/login" style="display:inline-block; padding:10px 18px; background:#243F82; color:#FFFFFF; text-decoration:none; border-radius:999px; font-weight:600;">Log in to Converge ↗</a></p>
                </div>
                """.formatted(toEmail, frontendUrl);

        sendEmail(toEmail, "Converge — Password Reset Confirmation", html, resetUrl);
    }

    public void sendFeedbackOrQueryEmail(String senderEmail, String message) {
        String targetAdmin = resolveAdminEmail();

        String html = """
                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #FFFFFF; border: 1px solid #E2E0D8; border-radius: 12px;">
                  <h2 style="margin-top:0;">New Converge Support Query / Feedback</h2>
                  <p><strong>From:</strong> %s</p>
                  <div style="background:#F6F4EC; padding:16px; border-radius:8px; margin:16px 0;">
                    <p style="margin:0; white-space: pre-wrap;">%s</p>
                  </div>
                  <p style="font-size:12px; color:#666;">Sent via Converge Help & Feedback Portal</p>
                </div>
                """.formatted(senderEmail != null && !senderEmail.isBlank() ? senderEmail : "Anonymous User", message);
        sendEmail(targetAdmin, "Converge Feedback & Query from " + (senderEmail != null && !senderEmail.isBlank() ? senderEmail : "User"), html, frontendUrl + "/dashboard");
    }
}
