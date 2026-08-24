package com.forgeboard.identity.domain;

import java.time.Instant;
import java.util.Locale;
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
    @Column(name = "invitation_email", length = 320)
    private String invitationEmail;
    @Column(name = "invitation_display_name", length = 160)
    private String invitationDisplayName;
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

    public static FirmMembership invited(UUID id, UUID firmId, String invitationEmail, String invitationDisplayName,
            MembershipRole role, Instant now) {
        FirmMembership membership = new FirmMembership();
        membership.id = Objects.requireNonNull(id, "id is required");
        membership.firmId = Objects.requireNonNull(firmId, "firmId is required");
        membership.invitationEmail = normalizeInvitationEmail(invitationEmail);
        membership.invitationDisplayName = normalizeInvitationDisplayName(invitationDisplayName);
        membership.status = MembershipStatus.INVITED;
        membership.role = Objects.requireNonNull(role, "role is required");
        membership.createdAt = Objects.requireNonNull(now, "now is required");
        membership.updatedAt = now;
        return membership;
    }

    public UUID firmId() { return firmId; }
    public UUID id() { return id; }
    public UUID userId() { return userId; }
    public String invitationEmail() { return invitationEmail; }
    public String invitationDisplayName() { return invitationDisplayName; }
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
        UUID requiredUserId = Objects.requireNonNull(userId, "userId is required for an active membership");
        if (this.userId != null && !this.userId.equals(requiredUserId))
            throw new IllegalStateException("Invitation is bound to another user");
        this.userId = requiredUserId;
        this.status = MembershipStatus.ACTIVE;
        this.updatedAt = Objects.requireNonNull(now, "now is required");
    }

    public void updateInvitation(String invitationEmail, String invitationDisplayName, MembershipRole role, Instant now) {
        if (status != MembershipStatus.INVITED)
            throw new IllegalStateException("Only invited memberships can update invitation details");
        this.invitationEmail = normalizeInvitationEmail(invitationEmail);
        this.invitationDisplayName = normalizeInvitationDisplayName(invitationDisplayName);
        this.role = Objects.requireNonNull(role, "role is required");
        this.updatedAt = Objects.requireNonNull(now, "now is required");
    }

    public void reinvite(String invitationEmail, String invitationDisplayName, MembershipRole role, Instant now) {
        if (status != MembershipStatus.REMOVED)
            throw new IllegalStateException("Only removed memberships can be reinvited");
        requireBoundUser();
        this.status = MembershipStatus.INVITED;
        updateInvitation(invitationEmail, invitationDisplayName, role, now);
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

    private static String normalizeInvitationEmail(String email) {
        if (email == null || email.isBlank()) throw new IllegalArgumentException("invitationEmail is required");
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (normalized.length() > 320) throw new IllegalArgumentException("invitationEmail is too long");
        return normalized;
    }

    private static String normalizeInvitationDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank())
            throw new IllegalArgumentException("invitationDisplayName is required");
        String normalized = displayName.strip();
        if (normalized.length() > 160) throw new IllegalArgumentException("invitationDisplayName is too long");
        return normalized;
    }
}
