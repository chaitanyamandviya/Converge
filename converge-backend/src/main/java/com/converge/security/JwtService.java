package com.converge.security;

import com.converge.ConvergeApplication;
import com.converge.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {

    public static final String ISSUER = "converge";
    public static final String TOKEN_TYPE_ACCESS = "access";
    public static final String TOKEN_TYPE_IG_OAUTH_STATE = "ig_oauth_state";
    private static final String KNOWN_INSECURE_DEFAULT =
            "converge-v2-super-secret-jwt-signing-key-must-be-at-least-64-bytes-long-for-hs512";

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            @Value("${app.jwt.secret:}") String secret,
            @Value("${app.jwt.expiration-ms:86400000}") long expirationMs) {
        this(secret, expirationMs, null);
    }

    @Autowired
    public JwtService(
            @Value("${app.jwt.secret:}") String secret,
            @Value("${app.jwt.expiration-ms:86400000}") long expirationMs,
            Environment env) {
        boolean productionMode = ConvergeApplication.isHostedProduction(env);
        String trimmed = secret != null ? secret.trim() : "";

        if (trimmed.isEmpty()) {
            if (productionMode) {
                throw new IllegalStateException("JWT_SECRET must be set to a strong >= 32 byte secret in production.");
            }
            byte[] randomBytes = new byte[32];
            new SecureRandom().nextBytes(randomBytes);
            this.key = Keys.hmacShaKeyFor(randomBytes);
            log.warn("JWT_SECRET is not set; generated an ephemeral local signing key for this dev run.");
        } else {
            if (KNOWN_INSECURE_DEFAULT.equals(trimmed)) {
                if (productionMode) {
                    throw new IllegalStateException("Default development JWT_SECRET cannot be used in production.");
                }
                log.warn("Default development JWT_SECRET detected in local configuration; rotate JWT_SECRET before deploying.");
            }
            byte[] bytes = trimmed.getBytes(StandardCharsets.UTF_8);
            if (bytes.length < 32) {
                throw new IllegalStateException("JWT_SECRET must be at least 32 UTF-8 bytes.");
            }
            this.key = Keys.hmacShaKeyFor(bytes);
        }
        this.expirationMs = expirationMs;
    }

    public String generateToken(User user) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .issuer(ISSUER)
                .subject(user.getEmail())
                .claims(Map.of(
                        "typ", TOKEN_TYPE_ACCESS,
                        "uid", user.getId().toString(),
                        "role", user.getRole(),
                        "name", user.getName(),
                        "verified", user.isVerified()
                ))
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }

    public String generateInstagramOAuthState(UUID creatorId, String actorEmail) {
        if (creatorId == null || actorEmail == null || actorEmail.isBlank()) {
            throw new IllegalArgumentException("Creator and authenticated user are required to start Instagram OAuth.");
        }
        Date now = new Date();
        Date exp = new Date(now.getTime() + 900_000L);
        return Jwts.builder()
                .issuer(ISSUER)
                .subject(actorEmail.trim().toLowerCase())
                .claims(Map.of(
                        "typ", TOKEN_TYPE_IG_OAUTH_STATE,
                        "cid", creatorId.toString(),
                        "nonce", UUID.randomUUID().toString()
                ))
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }

    public UUID parseInstagramOAuthState(String stateToken, String actorEmail, boolean isAdmin) {
        if (stateToken == null || stateToken.isBlank()) {
            throw new IllegalArgumentException("Missing or invalid Instagram OAuth state parameter.");
        }
        Claims claims;
        try {
            claims = parseClaims(stateToken);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Instagram OAuth state is invalid or expired. Please generate a new connect link.");
        }
        if (!TOKEN_TYPE_IG_OAUTH_STATE.equals(claims.get("typ", String.class))) {
            throw new IllegalArgumentException("Invalid Instagram OAuth state token type.");
        }
        String boundActor = claims.getSubject();
        if (!isAdmin && (boundActor == null || actorEmail == null || !boundActor.equalsIgnoreCase(actorEmail.trim()))) {
            throw new IllegalArgumentException("Instagram OAuth state does not match the signed-in user.");
        }
        String cidRaw = claims.get("cid", String.class);
        if (cidRaw == null || cidRaw.isBlank()) {
            throw new IllegalArgumentException("Instagram OAuth state is missing the target creator.");
        }
        return UUID.fromString(cidRaw);
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .requireIssuer(ISSUER)
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
