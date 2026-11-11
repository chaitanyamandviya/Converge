package com.converge.converge_backend.service;

import com.converge.converge_backend.config.ResendProperties;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.templates.model.CreateTemplateOptions;
import com.resend.services.templates.model.CreateTemplateResponseSuccess;
import com.resend.services.templates.model.Variable;
import com.resend.services.templates.model.VariableType;
import jakarta.annotation.PostConstruct;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private final ResendProperties resendProperties;
    private final RestTemplate restTemplate;

    @Value("${app.frontend-url:https://converge-etp.pages.dev}")
    private String frontendUrl;

    public EmailService(ResendProperties resendProperties) {
        this.resendProperties = resendProperties;
        this.restTemplate = new RestTemplate();
    }

    public boolean isConfigured() {
        String key = resendProperties.getApiKey();
        return key != null && !key.isBlank() && !key.contains("YOUR_RESEND_API_KEY");
    }

    @PostConstruct
    public void initTemplatesAsync() {
        if (isConfigured()) {
            CompletableFuture.runAsync(this::provisionResendTemplates);
        }
    }

    /**
     * Creates the official Converge email templates in Resend using the Resend Java SDK
     * (CreateTemplateOptions + Variable + VariableType).
     */
    public Map<String, String> provisionResendTemplates() {
        Map<String, String> createdTemplates = new LinkedHashMap<>();
        if (!isConfigured()) {
            return createdTemplates;
        }

        Resend resend = new Resend(resendProperties.getApiKey().trim());

        List<CreateTemplateOptions> definitions = List.of(
                CreateTemplateOptions.builder()
                        .name("converge-workspace-invitation")
                        .html("""
                                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #F6F4EC; border-radius: 12px;">
                                  <h2 style="margin-top:0;">You've been invited to Converge</h2>
                                  <p>Your <strong>{{{ROLE_LABEL}}}</strong> workspace for <strong>{{{ORG_NAME}}}</strong> has been provisioned.</p>
                                  <div style="background:#FFFFFF; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #E2E0D8;">
                                    <p style="margin:4px 0;"><strong>Account Email:</strong> {{{RECIPIENT_EMAIL}}}</p>
                                    <p style="margin:4px 0;"><strong>Role:</strong> {{{ROLE_LABEL}}}</p>
                                  </div>
                                  <p>Click the button below to set your initial password and access your workspace:</p>
                                  <p style="margin: 20px 0;">
                                    <a href="{{{SET_PASSWORD_URL}}}" style="display:inline-block; padding:12px 22px; background:#243F82; color:#FFFFFF; text-decoration:none; border-radius:999px; font-weight:600;">Set Initial Password &amp; Sign In ↗</a>
                                  </p>
                                </div>
                                """)
                        .addVariable(new Variable("ROLE_LABEL", VariableType.STRING, "Agency Manager"))
                        .addVariable(new Variable("ORG_NAME", VariableType.STRING, "Partner Agency"))
                        .addVariable(new Variable("RECIPIENT_EMAIL", VariableType.STRING, "user@example.com"))
                        .addVariable(new Variable("SET_PASSWORD_URL", VariableType.STRING, frontendUrl + "/login?mode=forgot"))
                        .build(),

                CreateTemplateOptions.builder()
                        .name("converge-onboarding-pending")
                        .html("""
                                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #F6F4EC; border-radius: 12px;">
                                  <h2 style="margin-top:0;">Application Received — {{{ORG_NAME}}}</h2>
                                  <p>Hi {{{APPLICANT_NAME}}},</p>
                                  <p>Your self-onboarding application for <strong>{{{ORG_NAME}}}</strong> ({{{ROLE_LABEL}}}) has been received by Converge.</p>
                                  <p><strong>Partner Brand:</strong> {{{PARTNER_BRAND}}}</p>
                                  <p>Your workspace is currently <strong>Pending Approval</strong> by the {{{APPROVER_LABEL}}}. You will receive a confirmation email as soon as your account is activated.</p>
                                </div>
                                """)
                        .addVariable(new Variable("ORG_NAME", VariableType.STRING, "Organization"))
                        .addVariable(new Variable("APPLICANT_NAME", VariableType.STRING, "Applicant"))
                        .addVariable(new Variable("ROLE_LABEL", VariableType.STRING, "Partner Agency"))
                        .addVariable(new Variable("PARTNER_BRAND", VariableType.STRING, "Brand Workspace"))
                        .addVariable(new Variable("APPROVER_LABEL", VariableType.STRING, "Brand Manager"))
                        .build(),

                CreateTemplateOptions.builder()
                        .name("converge-approval-request")
                        .html("""
                                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #FFFFFF; border: 1px solid #E2E0D8; border-radius: 12px;">
                                  <h2 style="margin-top:0;">New {{{ROLE_LABEL}}} Approval Request</h2>
                                  <p><strong>Organization:</strong> {{{ORG_NAME}}}</p>
                                  <p><strong>Applicant:</strong> {{{APPLICANT_NAME}}} ({{{APPLICANT_EMAIL}}})</p>
                                  <p><strong>Partner Brand:</strong> {{{PARTNER_BRAND}}}</p>
                                  <p>Log in to your Converge dashboard at <a href="{{{DASHBOARD_URL}}}">{{{DASHBOARD_URL}}}</a> to review and click <strong>✓ Approve</strong>.</p>
                                </div>
                                """)
                        .addVariable(new Variable("ROLE_LABEL", VariableType.STRING, "Partner Agency"))
                        .addVariable(new Variable("ORG_NAME", VariableType.STRING, "Organization"))
                        .addVariable(new Variable("APPLICANT_NAME", VariableType.STRING, "Manager"))
                        .addVariable(new Variable("APPLICANT_EMAIL", VariableType.STRING, "user@example.com"))
                        .addVariable(new Variable("PARTNER_BRAND", VariableType.STRING, "Brand Workspace"))
                        .addVariable(new Variable("DASHBOARD_URL", VariableType.STRING, frontendUrl + "/dashboard"))
                        .build(),

                CreateTemplateOptions.builder()
                        .name("converge-workspace-approved")
                        .html("""
                                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #F6F4EC; border-radius: 12px;">
                                  <h2 style="margin-top:0; color: #527E5A;">✓ Your {{{ROLE_LABEL}}} is Approved!</h2>
                                  <p>Great news — <strong>{{{ORG_NAME}}}</strong> has been approved and activated on Converge.</p>
                                  <p>You can now sign in with your registered email (<strong>{{{RECIPIENT_EMAIL}}}</strong>) or set a new password below:</p>
                                  <p style="margin: 20px 0;">
                                    <a href="{{{LOGIN_URL}}}" style="display:inline-block; padding:10px 18px; background:#243F82; color:#FFFFFF; text-decoration:none; border-radius:999px; font-weight:600; margin-right: 10px;">Log in to Converge ↗</a>
                                    <a href="{{{SET_PASSWORD_URL}}}" style="display:inline-block; padding:10px 18px; background:#FFFFFF; color:#243F82; border:1px solid #243F82; text-decoration:none; border-radius:999px; font-weight:600;">Set / Reset Password ↗</a>
                                  </p>
                                </div>
                                """)
                        .addVariable(new Variable("ROLE_LABEL", VariableType.STRING, "Agency Workspace"))
                        .addVariable(new Variable("ORG_NAME", VariableType.STRING, "Organization"))
                        .addVariable(new Variable("RECIPIENT_EMAIL", VariableType.STRING, "user@example.com"))
                        .addVariable(new Variable("LOGIN_URL", VariableType.STRING, frontendUrl + "/login"))
                        .addVariable(new Variable("SET_PASSWORD_URL", VariableType.STRING, frontendUrl + "/login?mode=forgot"))
                        .build(),

                CreateTemplateOptions.builder()
                        .name("converge-password-reset")
                        .html("""
                                <div style="font-family: Inter, sans-serif; color: #243F82; max-width: 560px; padding: 24px; background: #F6F4EC; border-radius: 12px;">
                                  <h2 style="margin-top:0;">Converge Password Updated</h2>
                                  <p>The password for your Converge account (<strong>{{{RECIPIENT_EMAIL}}}</strong>) has been updated.</p>
                                  <p><a href="{{{RESET_URL}}}" style="display:inline-block; padding:10px 18px; background:#243F82; color:#FFFFFF; text-decoration:none; border-radius:999px; font-weight:600;">Log in to Converge ↗</a></p>
                                </div>
                                """)
                        .addVariable(new Variable("RECIPIENT_EMAIL", VariableType.STRING, "user@example.com"))
                        .addVariable(new Variable("RESET_URL", VariableType.STRING, frontendUrl + "/login"))
                        .build()
        );

        for (CreateTemplateOptions options : definitions) {
            try {
                CreateTemplateResponseSuccess data = resend.templates().create(options);
                createdTemplates.put(options.getName(), data.getId());
                log.info("Provisioned Resend template '{}' with ID: {}", options.getName(), data.getId());
            } catch (ResendException ex) {
                createdTemplates.put(options.getName(), "exists_or_skipped: " + ex.getMessage());
                log.debug("Resend template '{}' check: {}", options.getName(), ex.getMessage());
            } catch (Exception ex) {
                createdTemplates.put(options.getName(), "skipped: " + ex.getMessage());
            }
        }
        return createdTemplates;
    }

    public void sendEmail(String to, String subject, String htmlBody, String actionUrl) {
        CompletableFuture.runAsync(() -> dispatchEmailInternal(to, subject, htmlBody, actionUrl));
    }

    private void dispatchEmailInternal(String to, String subject, String htmlBody, String actionUrl) {
        String adminEmail = (resendProperties.getAdminEmail() != null && !resendProperties.getAdminEmail().isBlank())
                ? resendProperties.getAdminEmail().trim()
                : "chaitanyamandviya7@gmail.com";
        String fromAddress = (resendProperties.getFromEmail() != null && !resendProperties.getFromEmail().isBlank())
                ? resendProperties.getFromEmail().trim()
                : "Converge <onboarding@resend.dev>";

        if (!isConfigured()) {
            log.info("Email triggered for {} [Subject: {}] [Link: {}]", to, subject, actionUrl);
            return;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(resendProperties.getApiKey().trim());

        // 1. Always attempt direct delivery to the exact recipient email (`to`) first.
        // Once your custom domain is verified in Resend (and resend.from-email uses that domain),
        // Resend delivers directly to `to`.
        try {
            Map<String, Object> directPayload = Map.of(
                    "from", fromAddress,
                    "to", List.of(to),
                    "subject", subject,
                    "html", htmlBody
            );
            restTemplate.postForEntity(RESEND_API_URL, new HttpEntity<>(directPayload, headers), String.class);
            log.info("Delivered email directly via Resend to {} [Subject: {}] [Link: {}]", to, subject, actionUrl);
            return;
        } catch (Exception directEx) {
            // 2. While your custom domain is still in "Pending / Checking DNS" on Resend,
            // Resend restricts delivery to the account owner (adminEmail). Fall back automatically so no email is lost.
            if (!to.equalsIgnoreCase(adminEmail)) {
                try {
                    Map<String, Object> fallbackPayload = Map.of(
                            "from", "Converge <onboarding@resend.dev>",
                            "to", List.of(adminEmail),
                            "subject", "[For: " + to + "] " + subject,
                            "html", buildSandboxBanner(to, adminEmail, actionUrl) + htmlBody
                    );
                    restTemplate.postForEntity(RESEND_API_URL, new HttpEntity<>(fallbackPayload, headers), String.class);
                    log.info("Domain DNS still pending in Resend — delivered email for {} to owner inbox {} [Link: {}]", to, adminEmail, actionUrl);
                    return;
                } catch (Exception retryEx) {
                    log.warn("Resend fallback notice for {}: {}", to, retryEx.getMessage());
                }
            }
            log.warn("Resend delivery notice for {} [Link: {}]: {}", to, actionUrl, directEx.getMessage());
        }
    }

    private String buildSandboxBanner(String intendedRecipient, String adminEmail, String actionUrl) {
        String linkHtml = (actionUrl != null && !actionUrl.isBlank())
                ? "<br/>Direct Action Link: <a href=\"" + actionUrl + "\" style=\"color:#243F82;font-weight:700;\">" + actionUrl + "</a>"
                : "";
        return """
                <div style="font-family: Inter, sans-serif; background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; padding:12px 14px; border-radius:8px; margin-bottom:14px; font-size:12px; line-height:1.5;">
                  <strong>Domain DNS Pending in Resend (Temporary Owner Routing):</strong><br/>
                  Intended Recipient: <strong>%s</strong> — Delivered to <strong>%s</strong> until your domain finishes DNS verification in Resend.%s
                </div>
                """.formatted(intendedRecipient, adminEmail, linkHtml);
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
                : ((resendProperties.getAdminEmail() != null && !resendProperties.getAdminEmail().isBlank())
                    ? resendProperties.getAdminEmail().trim()
                    : "chaitanyamandviya7@gmail.com");

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
        String targetAdmin = (resendProperties.getAdminEmail() != null && !resendProperties.getAdminEmail().isBlank())
                ? resendProperties.getAdminEmail().trim()
                : "chaitanyamandviya7@gmail.com";

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
