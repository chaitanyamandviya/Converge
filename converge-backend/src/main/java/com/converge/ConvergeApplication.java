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
                HikariConfig cfg = new HikariConfig();
                cfg.setJdbcUrl(jdbcUrl);
                if (resolvedUser != null) cfg.setUsername(resolvedUser);
                if (resolvedPass != null) cfg.setPassword(resolvedPass);
                cfg.setDriverClassName("org.postgresql.Driver");
                cfg.setConnectionTimeout(20000);
                try (HikariDataSource ds = new HikariDataSource(cfg);
                     Connection ignored = ds.getConnection()) {
                    System.out.println("Connected to Neon PostgreSQL via HikariCP successfully.");
                    System.setProperty("spring.datasource.url", jdbcUrl);
                    if (resolvedUser != null) System.setProperty("spring.datasource.username", resolvedUser);
                    if (resolvedPass != null) System.setProperty("spring.datasource.password", resolvedPass);
                } catch (Exception ex) {
                    System.err.println("PostgreSQL unavailable (" + ex.getMessage() + "), activating 'local' H2 PostgreSQL-mode profile.");
                    app.setAdditionalProfiles("local");
                }
            } else {
                app.setAdditionalProfiles("local");
            }
        } else {
            app.setAdditionalProfiles("local");
        }

        app.run(args);
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
        Map<String, String> directAliases = Map.of(
                "INSTAGRAM_ACCESS_TOKEN", "instagram.access-token",
                "INSTAGRAM_BUSINESS_ACCOUNT_ID", "instagram.user-id",
                "INSTAGRAM_APP_ID", "instagram.app-id",
                "INSTAGRAM_APP_SECRET", "instagram.app-secret",
                "INSTAGRAM_REDIRECT_URI", "instagram.redirect-uri",
                "INSTAGRAM_CREATOR_MARKETPLACE_ENABLED", "instagram.creator-marketplace-enabled",
                "FRONTEND_URL", "app.frontend-url",
                "DATABASE_URL", "DB_URL",
                "DATABASE_USERNAME", "DB_USERNAME",
                "DATABASE_PASSWORD", "DB_PASSWORD"
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
