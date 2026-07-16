package com.forgeboard.identity.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "api_refresh_tokens")
public class ApiRefreshToken {
    @Id private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "family_id", nullable = false) private UUID familyId;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) private String tokenHash;
    @Column(name = "access_token_jti", nullable = false, unique = true) private UUID accessTokenJti;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "used_at") private Instant usedAt;
    @Column(name = "revoked_at") private Instant revokedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "last_used_at") private Instant lastUsedAt;

    protected ApiRefreshToken() { }

    public ApiRefreshToken(UUID id, UUID userId, UUID familyId, String tokenHash, UUID accessTokenJti,
            Instant expiresAt, Instant now) {
        this.id = id; this.userId = userId; this.familyId = familyId; this.tokenHash = tokenHash;
        this.accessTokenJti = accessTokenJti; this.expiresAt = expiresAt; this.createdAt = now;
    }

    public UUID userId() { return userId; }
    public UUID familyId() { return familyId; }
    public UUID accessTokenJti() { return accessTokenJti; }
    public Instant expiresAt() { return expiresAt; }
    public Instant usedAt() { return usedAt; }
    public Instant revokedAt() { return revokedAt; }
    public boolean isExpired(Instant now) { return !expiresAt.isAfter(now); }
    public void markUsed(Instant now) { usedAt = now; lastUsedAt = now; }
    public void revoke(Instant now) { revokedAt = now; }
}
