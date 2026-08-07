package com.forgeboard.identity.domain;

import java.time.Instant;
import java.util.Objects;
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
    @Column(name = "user_id")
    private UUID userId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private MembershipStatus status;
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
        this.id = Objects.requireNonNull(id, "id is required");
        this.firmId = Objects.requireNonNull(firmId, "firmId is required");
        this.userId = Objects.requireNonNull(userId, "userId is required for an active membership");
        this.status = MembershipStatus.ACTIVE;
        this.role = Objects.requireNonNull(role, "role is required");
        this.createdAt = Objects.requireNonNull(now, "now is required");
        this.updatedAt = now;
    }

    public static FirmMembership invited(UUID id, UUID firmId, MembershipRole role, Instant now) {
        FirmMembership membership = new FirmMembership();
        membership.id = Objects.requireNonNull(id, "id is required");
        membership.firmId = Objects.requireNonNull(firmId, "firmId is required");
        membership.status = MembershipStatus.INVITED;
        membership.role = Objects.requireNonNull(role, "role is required");
        membership.createdAt = Objects.requireNonNull(now, "now is required");
        membership.updatedAt = now;
        return membership;
    }

    public UUID firmId() { return firmId; }
    public UUID id() { return id; }
    public UUID userId() { return userId; }
    public MembershipRole role() { return role; }
    public MembershipStatus status() { return status; }

    public void changeRole(MembershipRole role, Instant now) {
        requireNotRemoved();
        this.role = Objects.requireNonNull(role, "role is required");
        this.updatedAt = Objects.requireNonNull(now, "now is required");
    }

    public void activate(UUID userId, Instant now) {
        if (status != MembershipStatus.INVITED)
            throw new IllegalStateException("Only invited memberships can be activated");
        this.userId = Objects.requireNonNull(userId, "userId is required for an active membership");
        this.status = MembershipStatus.ACTIVE;
        this.updatedAt = Objects.requireNonNull(now, "now is required");
    }

    public void suspend(Instant now) {
        requireBoundUser();
        requireNotRemoved();
        this.status = MembershipStatus.SUSPENDED;
        this.updatedAt = Objects.requireNonNull(now, "now is required");
    }

    public void reactivate(Instant now) {
        requireBoundUser();
        requireNotRemoved();
        this.status = MembershipStatus.ACTIVE;
        this.updatedAt = Objects.requireNonNull(now, "now is required");
    }

    public void remove(Instant now) {
        requireBoundUser();
        this.status = MembershipStatus.REMOVED;
        this.updatedAt = Objects.requireNonNull(now, "now is required");
    }

    private void requireBoundUser() {
        if (userId == null)
            throw new IllegalStateException("Only a membership bound to a user can enter this state");
    }

    private void requireNotRemoved() {
        if (status == MembershipStatus.REMOVED)
            throw new IllegalStateException("Removed memberships are terminal");
    }
}
