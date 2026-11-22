package com.converge;

import com.converge.service.EmailService;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DeploymentAndEmailConfigTest {

    @Test
    void emailServiceNormalizesUrlAndBuildsLoginAndOnboardingLinks() {
        EmailService emailService = new EmailService("", "noreply@converge.run.place", "Converge", "https://converge-etp.pages.dev/");

        assertEquals(
                "https://converge-etp.pages.dev/auth?mode=signin&email=alice%40brand.com",
                emailService.buildAuthUrl("signin", "alice@brand.com")
        );
        assertEquals(
                "https://converge-etp.pages.dev/auth?mode=signup&email=alice%40brand.com",
                emailService.buildAuthUrl("signup", "alice@brand.com")
        );
    }

    @Test
    void emailServiceDefaultsBlankUnreachableAndHostedLocalhostUrlsToProductionPages() {
        EmailService blankService = new EmailService("", "noreply@converge.run.place", "Converge", "   ");
        assertEquals(
                "https://converge-etp.pages.dev/auth?mode=signin",
                blankService.buildAuthUrl("signin", null)
        );
        assertEquals("https://converge-etp.pages.dev/converge-logo.png", blankService.getLogoUrl());

        EmailService unreachableService = new EmailService("", "noreply@converge.run.place", "Converge", "https://converge.run.place");
        assertEquals(
                "https://converge-etp.pages.dev/auth?mode=signin&email=alice%40brand.com",
                unreachableService.buildAuthUrl("signin", "alice@brand.com")
        );
        assertEquals("https://converge-etp.pages.dev/converge-logo.png", unreachableService.getLogoUrl());

        assertEquals("https://converge-etp.pages.dev", EmailService.normalizeFrontendUrl("http://localhost:4200", true));
        EmailService localService = new EmailService("", "noreply@converge.run.place", "Converge", "http://localhost:4200");
        assertEquals("https://converge-etp.pages.dev/converge-logo.png", localService.getLogoUrl());
    }

    @Test
    void normalizePostgresConfigConvertsStandardUriAndResolvesCredentials() {
        String[] parsed = ConvergeApplication.normalizePostgresConfig(
                "postgresql://neondb_owner:secret123@ep-cool-moon.aws.neon.tech/converge?sslmode=require",
                "",
                ""
        );

        assertEquals("jdbc:postgresql://ep-cool-moon.aws.neon.tech/converge?sslmode=require", parsed[0]);
        assertEquals("neondb_owner", parsed[1]);
        assertEquals("secret123", parsed[2]);
        assertEquals(
                "jdbc:postgresql://ep-cool-moon.aws.neon.tech/converge?sslmode=require&socketFactory=com.converge.config.PublicDnsSocketFactory",
                ConvergeApplication.withPublicDnsSocketFactory(parsed[0])
        );
    }

    @Test
    void applyEnvAliasesMapsRenderV1DbAndFrontendVars() {
        Map<String, String> env = new HashMap<>();
        env.put("DB_URL", "jdbc:postgresql://db.example.com/converge");
        env.put("DB_USERNAME", "postgres");
        env.put("DB_PASSWORD", "pw");
        env.put("app.frontend-url", "https://converge-etp.pages.dev");

        ConvergeApplication.applyInstagramEnvAliases(env::get, env::put);

        assertEquals("jdbc:postgresql://db.example.com/converge", env.get("DATABASE_URL"));
        assertEquals("postgres", env.get("DATABASE_USERNAME"));
        assertEquals("pw", env.get("DATABASE_PASSWORD"));
        assertEquals("https://converge-etp.pages.dev", env.get("FRONTEND_URL"));
    }
}
