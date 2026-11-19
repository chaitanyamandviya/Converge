package com.converge;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.File;
import java.net.URI;
import java.sql.Connection;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.regex.Pattern;

@SpringBootApplication
public class ConvergeApplication {

    private static final Pattern VERSION_SUFFIX_PATTERN = Pattern.compile(".*/v\\d+(?:\\.\\d+)?$");

    public static void main(String[] args) {
        loadEnv();

        SpringApplication app = new SpringApplication(ConvergeApplication.class);
        String rawDbUrl = firstNonBlank(getEnv("DATABASE_URL"), getEnv("DB_URL"));
        String dbUser = firstNonBlank(getEnv("DATABASE_USERNAME"), getEnv("DB_USERNAME"));
        String dbPass = firstNonBlank(getEnv("DATABASE_PASSWORD"), getEnv("DB_PASSWORD"));

        if (rawDbUrl != null && !rawDbUrl.isBlank()) {
            String[] parsed = normalizePostgresConfig(rawDbUrl, dbUser, dbPass);
            String jdbcUrl = parsed[0];
            String resolvedUser = parsed[1];
            String resolvedPass = parsed[2];

            if (jdbcUrl.startsWith("jdbc:postgresql://")) {
                if (tryConnectPostgres(jdbcUrl, resolvedUser, resolvedPass)) {
                    System.out.println("Connected to Neon PostgreSQL via HikariCP successfully.");
                    System.setProperty("spring.datasource.url", jdbcUrl);
                    if (!resolvedUser.isEmpty()) System.setProperty("spring.datasource.username", resolvedUser);
                    if (!resolvedPass.isEmpty()) System.setProperty("spring.datasource.password", resolvedPass);
                } else if (!isH2FallbackAllowed()) {
                    throw new IllegalStateException("Neon PostgreSQL connection failed and H2 fallback is disabled (ALLOW_H2_FALLBACK=false / RENDER). Fix DNS or DATABASE_URL credentials.");
                } else {
                    app.setAdditionalProfiles("local");
                }
            } else {
                app.setAdditionalProfiles("local");
            }
        } else {
            if (!isH2FallbackAllowed()) {
                throw new IllegalStateException("DATABASE_URL / DB_URL is missing and H2 fallback is disabled.");
            }
            app.setAdditionalProfiles("local");
        }

        app.run(args);
    }

    static boolean isH2FallbackAllowed() {
        String explicit = cleanEnvValue(getEnv("ALLOW_H2_FALLBACK"));
        if (!explicit.isEmpty()) {
            return !"false".equalsIgnoreCase(explicit) && !"0".equals(explicit);
        }
        return cleanEnvValue(getEnv("RENDER")).isEmpty();
    }

    private static boolean tryConnectPostgres(String jdbcUrl, String user, String pass) {
        String activeUrl = jdbcUrl;
        for (int attempt = 1; attempt <= 2; attempt++) {
            HikariConfig cfg = new HikariConfig();
            cfg.setJdbcUrl(activeUrl);
            if (user != null && !user.isEmpty()) cfg.setUsername(user);
            if (pass != null && !pass.isEmpty()) cfg.setPassword(pass);
            cfg.setDriverClassName("org.postgresql.Driver");
            cfg.setConnectionTimeout(15000);
            try (HikariDataSource ds = new HikariDataSource(cfg);
                 Connection ignored = ds.getConnection()) {
                if (!activeUrl.equals(jdbcUrl)) {
                    System.setProperty("DATABASE_URL", activeUrl);
                }
                return true;
            } catch (Exception ex) {
                Throwable root = ex;
                boolean unknownHost = false;
                while (root != null) {
                    if (root instanceof java.net.UnknownHostException) {
                        unknownHost = true;
                        break;
                    }
                    root = root.getCause();
                }
                String msg = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
                if (unknownHost) {
                    System.err.println("Neon PostgreSQL DNS resolution failed (" + msg + "). Set your network DNS to 1.1.1.1 / 8.8.8.8 so Windows can resolve the Neon host; falling back to 'local' H2 only if allowed.");
                    return false;
                }
                if (activeUrl.contains("channel_binding=") && msg.toLowerCase().contains("channel_binding")) {
                    activeUrl = activeUrl.replaceAll("([?&])channel_binding=[^&]*&?", "$1").replaceAll("[?&]$", "");
                }
                System.err.println("Neon PostgreSQL connection attempt " + attempt + " failed (" + msg + ").");
                if (attempt < 2) {
                    try { Thread.sleep(1500); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                }
            }
        }
        return false;
    }

    static String[] normalizePostgresConfig(String rawUrl, String user, String pass) {
        String url = cleanEnvValue(rawUrl);
        String resolvedUser = cleanEnvValue(user);
        String resolvedPass = cleanEnvValue(pass);

        if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
            try {
                URI uri = URI.create(url);
                String host = uri.getHost();
                int port = uri.getPort();
                String path = uri.getRawPath();
                String query = uri.getRawQuery();
                String userInfo = uri.getUserInfo();
                if (userInfo != null && !userInfo.isBlank()) {
                    int colon = userInfo.indexOf(':');
                    if (resolvedUser.isEmpty()) {
                        resolvedUser = colon >= 0 ? userInfo.substring(0, colon) : userInfo;
                    }
                    if (resolvedPass.isEmpty() && colon >= 0) {
                        resolvedPass = userInfo.substring(colon + 1);
                    }
                }
                if (host != null && !host.isBlank()) {
                    url = "jdbc:postgresql://" + host
                            + (port > 0 ? ":" + port : "")
                            + (path != null ? path : "")
                            + (query != null && !query.isBlank() ? "?" + query : "");
                }
            } catch (Exception ignored) {
                url = "jdbc:postgresql://" + url.replaceFirst("^postgres(ql)?://", "");
            }
        }
        return new String[]{url, resolvedUser, resolvedPass};
    }

    static String firstNonBlank(String a, String b) {
        String ca = cleanEnvValue(a);
        if (!ca.isEmpty()) return ca;
        String cb = cleanEnvValue(b);
        return cb.isEmpty() ? null : cb;
    }

    static void loadEnv() {
        Dotenv dotenv = Dotenv.configure()
                .directory(new File(".env").exists() ? "." : (new File("converge-backend/.env").exists() ? "converge-backend" : "."))
                .ignoreIfMissing()
                .load();
        dotenv.entries().forEach(entry -> {
            if (System.getProperty(entry.getKey()) == null && System.getenv(entry.getKey()) == null) {
                System.setProperty(entry.getKey(), cleanEnvValue(entry.getValue()));
            }
        });
        applyInstagramEnvAliases(ConvergeApplication::getEnv, (k, v) -> {
            if (v != null && !v.isBlank()) {
                System.setProperty(k, v);
            }
        });
    }

    static String getEnv(String key) {
        String prop = System.getProperty(key);
        return prop != null ? prop : System.getenv(key);
    }

    public static void applyInstagramEnvAliases(Function<String, String> reader, BiConsumer<String, String> writer) {
        Map<String, String> directAliases = Map.ofEntries(
                Map.entry("INSTAGRAM_ACCESS_TOKEN", "instagram.access-token"),
                Map.entry("INSTAGRAM_BUSINESS_ACCOUNT_ID", "instagram.user-id"),
                Map.entry("INSTAGRAM_APP_ID", "instagram.app-id"),
                Map.entry("INSTAGRAM_APP_SECRET", "instagram.app-secret"),
                Map.entry("INSTAGRAM_REDIRECT_URI", "instagram.redirect-uri"),
                Map.entry("INSTAGRAM_CREATOR_MARKETPLACE_ENABLED", "instagram.creator-marketplace-enabled"),
                Map.entry("FRONTEND_URL", "app.frontend-url"),
                Map.entry("DATABASE_URL", "DB_URL"),
                Map.entry("DATABASE_USERNAME", "DB_USERNAME"),
                Map.entry("DATABASE_PASSWORD", "DB_PASSWORD"),
                Map.entry("GOOGLE_CLIENT_ID", "google.client-id")
        );
        directAliases.forEach((target, source) -> {
            String existing = cleanEnvValue(reader.apply(target));
            if (existing.isEmpty()) {
                String fallback = cleanEnvValue(reader.apply(source));
                if (!fallback.isEmpty()) {
                    writer.accept(target, fallback);
                }
            }
        });

        if (cleanEnvValue(reader.apply("INSTAGRAM_GRAPH_API_BASE_URL")).isEmpty()) {
            String base = cleanEnvValue(reader.apply("instagram.graph-base-url"));
            String version = cleanEnvValue(reader.apply("instagram.api-version"));
            if (!base.isEmpty()) {
                base = base.replaceAll("/+$", "");
                if (!version.isEmpty() && !VERSION_SUFFIX_PATTERN.matcher(base).matches()) {
                    String normalizedVer = version.startsWith("v") ? version : "v" + version;
                    base = base + "/" + normalizedVer;
                }
                writer.accept("INSTAGRAM_GRAPH_API_BASE_URL", base);
            }
        }
    }

    private static String cleanEnvValue(String value) {
        if (value == null) return "";
        String s = value.trim();
        if ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("'") && s.endsWith("'"))) {
            if (s.length() >= 2) {
                s = s.substring(1, s.length() - 1).trim();
            }
        }
        return s;
    }
}
