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
import org.springframework.web.util.HtmlUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
    private static final String LOGO_URL = "https://converge-etp.pages.dev/assets/converge-logo.png";

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

    private String getBaseFrontendUrl() {
        if (frontendUrl == null || frontendUrl.isBlank()) {
            return "https://converge-etp.pages.dev";
        }
        String trimmed = frontendUrl.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            trimmed = "https://" + trimmed;
        }
        return trimmed;
    }

    /**
     * Builds a responsive, branded Converge HTML email template.
     * Features:
     * - Converge official logo mark + typography header
     * - Status badge pill
     * - Structured key-value details table
     * - High-contrast, mobile-friendly primary CTA button (table-based for universal email client support)
     * - Dual clickable fallback link for guaranteed clickability
     * - Professional Converge footer
     */
    private String renderEmailTemplate(
            String badgeText,
            String badgeBg,
            String badgeColor,
            String heading,
            String introHtml,
            List<Map.Entry<String, String>> detailRows,
            String outroHtml,
            String primaryButtonText,
            String primaryButtonUrl,
            String secondaryButtonText,
            String secondaryButtonUrl) {

        StringBuilder rowsHtml = new StringBuilder();
        if (detailRows != null && !detailRows.isEmpty()) {
            rowsHtml.append("<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"margin: 22px 0; background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;\">");
            for (int i = 0; i < detailRows.size(); i++) {
                Map.Entry<String, String> entry = detailRows.get(i);
                boolean isLast = (i == detailRows.size() - 1);
                String borderStyle = isLast ? "border-bottom: none;" : "border-bottom: 1px solid #F3F4F6;";
                rowsHtml.append("<tr>")
                        .append("<td style=\"padding: 11px 16px; font-size: 13px; font-weight: 600; color: #6B7280; width: 34%; vertical-align: top; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; ").append(borderStyle).append("\">")
                        .append(HtmlUtils.htmlEscape(entry.getKey()))
                        .append("</td>")
                        .append("<td style=\"padding: 11px 16px; font-size: 13px; font-weight: 600; color: #1F2937; vertical-align: top; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; ").append(borderStyle).append("\">")
                        .append(HtmlUtils.htmlEscape(entry.getValue()))
                        .append("</td>")
                        .append("</tr>");
            }
            rowsHtml.append("</table>");
        }

        String badgeHtml = "";
        if (badgeText != null && !badgeText.isBlank()) {
            badgeHtml = "<div style=\"display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; background-color: "
                    + badgeBg + "; color: " + badgeColor + "; margin-bottom: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\">"
                    + HtmlUtils.htmlEscape(badgeText)
                    + "</div>";
        }

        StringBuilder buttonsHtml = new StringBuilder();
        if (primaryButtonUrl != null && !primaryButtonUrl.isBlank() && primaryButtonText != null && !primaryButtonText.isBlank()) {
            buttonsHtml.append("<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin: 26px 0 16px 0;\">")
                    .append("<tr>")
                    .append("<td align=\"center\" bgcolor=\"#243F82\" style=\"border-radius: 8px; box-shadow: 0 2px 4px rgba(36, 63, 130, 0.25);\">")
                    .append("<a href=\"").append(primaryButtonUrl).append("\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display: inline-block; padding: 13px 26px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; border-radius: 8px; border: 1px solid #243F82; letter-spacing: -0.2px;\">")
                    .append(HtmlUtils.htmlEscape(primaryButtonText))
                    .append("</a>")
                    .append("</td>");

            if (secondaryButtonUrl != null && !secondaryButtonUrl.isBlank() && secondaryButtonText != null && !secondaryButtonText.isBlank()) {
                buttonsHtml.append("<td style=\"padding-left: 12px;\">")
                        .append("<a href=\"").append(secondaryButtonUrl).append("\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display: inline-block; padding: 13px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; color: #243F82; text-decoration: none; border-radius: 8px; border: 1px solid #D1D5DB; background-color: #FFFFFF;\">")
                        .append(HtmlUtils.htmlEscape(secondaryButtonText))
                        .append("</a>")
                        .append("</td>");
            }

            buttonsHtml.append("</tr></table>");

            // Dual Clickable Link Fallback for Guaranteed Clickability
            buttonsHtml.append("<div style=\"margin: 18px 0 0 0; padding-top: 14px; border-top: 1px dashed #E5E7EB;\">")
                    .append("<p style=\"margin: 0 0 4px 0; font-size: 12px; color: #6B7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\">")
                    .append("Having trouble with the button? Click or copy this link directly:")
                    .append("</p>")
                    .append("<p style=\"margin: 0; font-size: 12px; word-break: break-all; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\">")
                    .append("<a href=\"").append(primaryButtonUrl).append("\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color: #243F82; font-weight: 600; text-decoration: underline;\">")
                    .append(primaryButtonUrl)
                    .append("</a>")
                    .append("</p>")
                    .append("</div>");
        }

        return """
                <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
                <head>
                  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                  <title>Converge</title>
                </head>
                <body style="margin:0; padding:0; background-color:#F4F5F7; -webkit-text-size-adjust:100%%; -ms-text-size-adjust:100%%;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%%" style="background-color:#F4F5F7; min-height:100vh; padding:36px 16px;">
                    <tr>
                      <td align="center" valign="top">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%%" style="max-width:580px; background-color:#FFFFFF; border-radius:12px; border:1px solid #E5E7EB; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.04);">
                          <!-- Brand Accent Top Stripe -->
                          <tr>
                            <td height="5" style="background-color:#243F82; font-size:0; line-height:0;">&nbsp;</td>
                          </tr>
                          <!-- Header with Converge Logo -->
                          <tr>
                            <td style="padding:28px 32px 20px 32px; text-align:center; border-bottom:1px solid #F3F4F6;">
                              <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                                <tr>
                                  <td style="vertical-align:middle; padding-right:10px;">
                                    <img src="%s" width="34" height="34" alt="Converge" style="display:block; width:34px; height:34px; border:0; border-radius:8px;" />
                                  </td>
                                  <td style="vertical-align:middle;">
                                    <span style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:24px; font-weight:800; color:#1F2124; letter-spacing:-0.5px;">converge</span>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <!-- Content Card -->
                          <tr>
                            <td style="padding:32px 32px 28px 32px; text-align:left;">
                              %s
                              <h1 style="margin:0 0 14px 0; font-size:21px; font-weight:700; color:#111827; line-height:1.3; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">%s</h1>
                              <div style="font-size:14px; line-height:1.6; color:#374151; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                %s
                              </div>
                              %s
                              <div style="font-size:14px; line-height:1.6; color:#4B5563; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                %s
                              </div>
                              %s
                            </td>
                          </tr>
                          <!-- Footer -->
                          <tr>
                            <td style="padding:22px 32px; background-color:#FAFAFA; border-top:1px solid #F3F4F6; text-align:center;">
                              <p style="margin:0 0 6px 0; font-size:12px; font-weight:600; color:#6B7280; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Converge Platform &bull; Creator &amp; Brand Workspace</p>
                              <p style="margin:0; font-size:11px; color:#9CA3AF; line-height:1.5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">&copy; 2026 Converge Platform. All rights reserved.<br/>This is an automated operational notification regarding your Converge workspace.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                        LOGO_URL,
                        badgeHtml,
                        HtmlUtils.htmlEscape(heading),
                        introHtml,
                        rowsHtml.toString(),
                        outroHtml != null ? outroHtml : "",
                        buttonsHtml.toString()
                );
    }

    public void sendOnboardingApplicationEmails(
            String applicantEmail,
            String fullName,
            String orgName,
            String role,
            String websiteUrl,
            String approverEmail,
            String partnerBrandName) {

        String baseUrl = getBaseFrontendUrl();
        String roleLabel = "BRAND_MANAGER".equalsIgnoreCase(role) ? "Brand Workspace" : "Partner Agency";
        String approverLabel = "BRAND_MANAGER".equalsIgnoreCase(role)
                ? "System Administrator"
                : ("Brand Manager" + (partnerBrandName != null && !partnerBrandName.isBlank() ? " (" + partnerBrandName + ")" : ""));

        // 1. Confirmation Email to Applicant
        List<Map.Entry<String, String>> applicantRows = new ArrayList<>();
        applicantRows.add(new AbstractMap.SimpleEntry<>("Workspace Name", orgName));
        applicantRows.add(new AbstractMap.SimpleEntry<>("Workspace Type", roleLabel));
        applicantRows.add(new AbstractMap.SimpleEntry<>("Account Email", applicantEmail));
        if (partnerBrandName != null && !partnerBrandName.isBlank()) {
            applicantRows.add(new AbstractMap.SimpleEntry<>("Partner Brand", partnerBrandName));
        }
        if (websiteUrl != null && !websiteUrl.isBlank()) {
            applicantRows.add(new AbstractMap.SimpleEntry<>("Website", websiteUrl));
        }
        applicantRows.add(new AbstractMap.SimpleEntry<>("Status", "Pending Review by " + approverLabel));

        String displayName = (fullName != null && !fullName.isBlank()) ? fullName.trim() : applicantEmail;
        String applicantIntro = "<p style=\"margin:0 0 12px 0;\">Hi <strong>" + HtmlUtils.htmlEscape(displayName) + "</strong>,</p>"
                + "<p style=\"margin:0;\">Thank you for submitting your self-onboarding application for <strong>" + HtmlUtils.htmlEscape(orgName) + "</strong>. Your workspace request has been received and is currently under review.</p>";
        String applicantOutro = "<p style=\"margin:0;\">You will receive an email confirmation as soon as your workspace is approved and ready for you to access.</p>";

        String applicantLoginUrl = baseUrl + "/login";
        String applicantHtml = renderEmailTemplate(
                "⏳ Application Received • Pending Approval",
                "#FEF3C7",
                "#92400E",
                "Application Received — " + orgName,
                applicantIntro,
                applicantRows,
                applicantOutro,
                "Go to Converge Portal ↗",
                applicantLoginUrl,
                null,
                null
        );

        sendEmail(applicantEmail, "Converge — Application Received (" + orgName + ")", applicantHtml, applicantLoginUrl);

        // 2. Notification Email to Approver (System Admin or Brand Manager)
        String targetApprover = (approverEmail != null && !approverEmail.isBlank())
                ? approverEmail.trim()
                : resolveAdminEmail();

        List<Map.Entry<String, String>> approverRows = new ArrayList<>();
        approverRows.add(new AbstractMap.SimpleEntry<>("Organization", orgName));
        approverRows.add(new AbstractMap.SimpleEntry<>("Workspace Type", roleLabel));
        approverRows.add(new AbstractMap.SimpleEntry<>("Applicant Name", displayName));
        approverRows.add(new AbstractMap.SimpleEntry<>("Applicant Email", applicantEmail));
        if (partnerBrandName != null && !partnerBrandName.isBlank()) {
            approverRows.add(new AbstractMap.SimpleEntry<>("Partner Brand", partnerBrandName));
        }
        if (websiteUrl != null && !websiteUrl.isBlank()) {
            approverRows.add(new AbstractMap.SimpleEntry<>("Website", websiteUrl));
        }

        String approverIntro = "<p style=\"margin:0;\">A new workspace registration for <strong>" + HtmlUtils.htmlEscape(orgName) + "</strong> has been submitted and is awaiting your review and approval.</p>";
        String approverOutro = "<p style=\"margin:0;\">Please log in to your Converge dashboard to review the application details and click <strong>✓ Approve</strong> to provision workspace access.</p>";

        String approverDashboardUrl = baseUrl + "/dashboard";
        String adminHtml = renderEmailTemplate(
                "🔔 Action Required • Pending Approval",
                "#DBEAFE",
                "#1E40AF",
                "New " + roleLabel + " Approval Request (" + orgName + ")",
                approverIntro,
                approverRows,
                approverOutro,
                "Review & Approve in Dashboard ↗",
                approverDashboardUrl,
                null,
                null
        );

        sendEmail(targetApprover, "Action Required: Approve " + orgName + " (" + roleLabel + ")", adminHtml, approverDashboardUrl);
    }

    public void sendApprovalConfirmationEmail(String toEmail, String orgName, String role) {
        String baseUrl = getBaseFrontendUrl();
        String roleLabel = "BRAND_MANAGER".equalsIgnoreCase(role) ? "Brand Workspace" : "Agency Workspace";
        String encodedEmail = URLEncoder.encode(toEmail, StandardCharsets.UTF_8);
        String setPasswordUrl = baseUrl + "/login?mode=forgot&email=" + encodedEmail;
        String loginUrl = baseUrl + "/login";

        List<Map.Entry<String, String>> rows = new ArrayList<>();
        rows.add(new AbstractMap.SimpleEntry<>("Workspace Name", orgName));
        rows.add(new AbstractMap.SimpleEntry<>("Workspace Type", roleLabel));
        rows.add(new AbstractMap.SimpleEntry<>("Account Email", toEmail));
        rows.add(new AbstractMap.SimpleEntry<>("Access Status", "✓ Approved & Active"));

        String intro = "<p style=\"margin:0 0 10px 0;\">Great news!</p>"
                + "<p style=\"margin:0;\">Your workspace <strong>" + HtmlUtils.htmlEscape(orgName) + "</strong> has been approved by the platform administrator and is now officially active on Converge.</p>";
        String outro = "<p style=\"margin:0;\">Click the button below to set your account password and access your workspace dashboard:</p>";

        String html = renderEmailTemplate(
                "✅ Workspace Approved & Ready",
                "#D1FAE5",
                "#065F46",
                "✓ Your " + roleLabel + " is Approved!",
                intro,
                rows,
                outro,
                "Set Password & Access Workspace ↗",
                setPasswordUrl,
                "Sign In Directly ↗",
                loginUrl
        );

        sendEmail(toEmail, "Approved: Welcome to Converge (" + orgName + ")", html, setPasswordUrl);
    }

    public void sendInvitationEmail(String toEmail, String orgName, String role) {
        String baseUrl = getBaseFrontendUrl();
        String roleLabel = "BRAND_MANAGER".equalsIgnoreCase(role) ? "Brand Manager" : "Agency Manager";
        String encodedEmail = URLEncoder.encode(toEmail, StandardCharsets.UTF_8);
        String setPasswordUrl = baseUrl + "/login?mode=forgot&email=" + encodedEmail;

        List<Map.Entry<String, String>> rows = new ArrayList<>();
        rows.add(new AbstractMap.SimpleEntry<>("Workspace", orgName));
        rows.add(new AbstractMap.SimpleEntry<>("Assigned Role", roleLabel));
        rows.add(new AbstractMap.SimpleEntry<>("Account Email", toEmail));

        String intro = "<p style=\"margin:0;\">You have been invited to join the Converge platform as a <strong>" + HtmlUtils.htmlEscape(roleLabel) + "</strong> for <strong>" + HtmlUtils.htmlEscape(orgName) + "</strong>.</p>";
        String outro = "<p style=\"margin:0;\">Click the button below to set your initial password and access your workspace dashboard:</p>";

        String html = renderEmailTemplate(
                "🎉 Workspace Invitation",
                "#EEF2FF",
                "#4338CA",
                "You've been invited to Converge",
                intro,
                rows,
                outro,
                "Set Initial Password & Sign In ↗",
                setPasswordUrl,
                null,
                null
        );

        sendEmail(toEmail, "Invitation to join Converge — Set Password for " + orgName, html, setPasswordUrl);
    }

    public void sendPasswordResetEmail(String toEmail) {
        String baseUrl = getBaseFrontendUrl();
        String encodedEmail = URLEncoder.encode(toEmail, StandardCharsets.UTF_8);
        String resetUrl = baseUrl + "/login?mode=forgot&email=" + encodedEmail;
        String loginUrl = baseUrl + "/login";

        List<Map.Entry<String, String>> rows = new ArrayList<>();
        rows.add(new AbstractMap.SimpleEntry<>("Account Email", toEmail));
        rows.add(new AbstractMap.SimpleEntry<>("Security Event", "Password Updated"));

        String intro = "<p style=\"margin:0;\">The password for your Converge account (<strong>" + HtmlUtils.htmlEscape(toEmail) + "</strong>) has been successfully updated.</p>";
        String outro = "<p style=\"margin:0;\">If you performed this action, no further steps are needed. If you did not make this change, please reset your password immediately or contact our support team.</p>";

        String html = renderEmailTemplate(
                "🔒 Security Notification",
                "#F1F5F9",
                "#334155",
                "Converge Password Updated",
                intro,
                rows,
                outro,
                "Sign In to Converge ↗",
                loginUrl,
                "Reset Password ↗",
                resetUrl
        );

        sendEmail(toEmail, "Converge — Password Updated Confirmation", html, resetUrl);
    }

    public void sendFeedbackOrQueryEmail(String senderEmail, String message) {
        String baseUrl = getBaseFrontendUrl();
        String targetAdmin = resolveAdminEmail();

        List<Map.Entry<String, String>> rows = new ArrayList<>();
        rows.add(new AbstractMap.SimpleEntry<>("From", senderEmail != null && !senderEmail.isBlank() ? senderEmail : "Anonymous User"));
        rows.add(new AbstractMap.SimpleEntry<>("Topic", "Help & Feedback Portal"));

        String intro = "<p style=\"margin:0;\">A user has submitted feedback or a support query through the Converge portal:</p>";
        String escapedMessage = HtmlUtils.htmlEscape(message != null ? message : "");
        String outro = "<div style=\"margin-top: 14px; background-color: #F9FAFB; border: 1px solid #E5E7EB; border-left: 4px solid #243F82; padding: 14px 18px; border-radius: 6px; font-size: 14px; color: #1F2937; line-height: 1.6; white-space: pre-wrap;\">"
                + escapedMessage + "</div>";

        String dashboardUrl = baseUrl + "/dashboard";
        String html = renderEmailTemplate(
                "💬 Support & Feedback Query",
                "#EDE9FE",
                "#5B21B6",
                "New Converge Support Query",
                intro,
                rows,
                outro,
                "Open Admin Dashboard ↗",
                dashboardUrl,
                null,
                null
        );

        sendEmail(targetAdmin, "Converge Feedback & Query from " + (senderEmail != null && !senderEmail.isBlank() ? senderEmail : "User"), html, dashboardUrl);
    }
}
