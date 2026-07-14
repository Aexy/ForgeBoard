package com.forgeboard.identity.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "firm_memberships")
public class FirmMembership {
    @Id
    private UUID id;
    @Column(name = "firm_id", nullable = false)
    private UUID firmId;
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private MembershipRole role;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version
    private long version;

    protected FirmMembership() {}

    public FirmMembership(UUID id, UUID firmId, UUID userId, MembershipRole role, Instant now) {
        this.id = id;
        this.firmId = firmId;
        this.userId = userId;
        this.role = role;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public UUID firmId() { return firmId; }
    public UUID id() { return id; }
    public UUID userId() { return userId; }
    public MembershipRole role() { return role; }
}
