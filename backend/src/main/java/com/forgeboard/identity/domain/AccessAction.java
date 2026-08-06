package com.forgeboard.identity.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "access_actions")
public class AccessAction {
    public static final Duration TOKEN_LIFETIME = Duration.ofDays(7);

    @Id
    private UUID id;
    @Column(name = "firm_id")
    private UUID firmId;
    @Column(name = "membership_id")
    private UUID membershipId;
    @Column(name = "user_id")
    private UUID userId;
    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 32)
    private AccessActionType type;
    @Column(name = "target_email", nullable = false, length = 320)
    private String targetEmail;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;
    @Column(name = "created_by_user_id")
    private UUID createdByUserId;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Column(name = "consumed_at")
    private Instant consumedAt;
    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected AccessAction() { }

    public AccessAction(UUID id, UUID firmId, UUID membershipId, UUID userId, AccessActionType type,
            String targetEmail, String tokenHash, UUID createdByUserId, Instant now) {
        this.id = Objects.requireNonNull(id, "id is required");
        this.firmId = firmId;
        this.membershipId = membershipId;
        this.userId = userId;
        this.type = Objects.requireNonNull(type, "type is required");
        this.targetEmail = Objects.requireNonNull(targetEmail, "targetEmail is required");
        this.tokenHash = Objects.requireNonNull(tokenHash, "tokenHash is required");
        this.createdByUserId = createdByUserId;
        this.createdAt = Objects.requireNonNull(now, "now is required");
        this.expiresAt = now.plus(TOKEN_LIFETIME);
        requireScopeForType();
    }

    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID membershipId() { return membershipId; }
    public UUID userId() { return userId; }
    public AccessActionType type() { return type; }
    public String targetEmail() { return targetEmail; }
    public String tokenHash() { return tokenHash; }
    public UUID createdByUserId() { return createdByUserId; }
    public Instant createdAt() { return createdAt; }
    public Instant expiresAt() { return expiresAt; }
    public Instant consumedAt() { return consumedAt; }
    public Instant revokedAt() { return revokedAt; }

    public boolean isRedeemable(Instant now) {
        Objects.requireNonNull(now, "now is required");
        return consumedAt == null && revokedAt == null && expiresAt.isAfter(now);
    }

    public void consume(Instant now) {
        if (!isRedeemable(now))
            throw new IllegalStateException("Access action is not redeemable");
        consumedAt = now;
    }

    public void revoke(Instant now) {
        Objects.requireNonNull(now, "now is required");
        if (revokedAt == null)
            revokedAt = now;
    }

    private void requireScopeForType() {
        if (type == AccessActionType.INVITATION && (firmId == null || membershipId == null))
            throw new IllegalArgumentException("Invitation actions require firm and membership IDs");
    }
}
