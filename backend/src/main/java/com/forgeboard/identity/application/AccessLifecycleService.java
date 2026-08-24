package com.forgeboard.identity.application;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.identity.domain.AccessAction;
import com.forgeboard.identity.domain.AccessActionType;
import com.forgeboard.identity.domain.ActivitySource;
import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.FirmStatus;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.persistence.AccessActionRepository;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;
import com.forgeboard.identity.security.ApiTokenService;

/** Shared, one-time lifecycle for firm invitations and password-reset credentials. */
@Service
public class AccessLifecycleService {
    private static final int DISPLAY_NAME_MAX_LENGTH = 160;
    private static final int PASSWORD_MIN_LENGTH = 12;
    private static final int PASSWORD_MAX_LENGTH = 200;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AccessActionRepository actions;
    private final FirmMembershipRepository memberships;
    private final FirmRepository firms;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final ApiTokenService tokens;
    private final ActivityAuditService audit;
    private final Clock clock;
    private final URI publicAppUrl;

    public AccessLifecycleService(AccessActionRepository actions, FirmMembershipRepository memberships,
            FirmRepository firms, UserRepository users, PasswordEncoder passwords, ApiTokenService tokens,
            ActivityAuditService audit, Clock clock,
            @Value("${FORGEBOARD_PUBLIC_APP_URL:http://localhost:3000}") String publicAppUrl) {
        this.actions = actions;
        this.memberships = memberships;
        this.firms = firms;
        this.users = users;
        this.passwords = passwords;
        this.tokens = tokens;
        this.audit = audit;
        this.clock = clock;
        this.publicAppUrl = validatePublicAppUrl(publicAppUrl);
    }

    @Transactional
    public GeneratedAccessLink createInvitation(UUID firmId, UUID actorId, InviteMemberRequest request) {
        return createInvitation(firmId, actorId, request, AccessManagementOrigin.FIRM);
    }

    @Transactional
    public GeneratedAccessLink createInvitation(UUID firmId, UUID actorId, InviteMemberRequest request,
            AccessManagementOrigin origin) {
        String email = normalizeEmail(request.email());
        String displayName = normalizeDisplayName(request.displayName());
        requireActiveFirmForManagement(firmId);
        serializeIssuance("invitation:" + firmId + ":" + email);
        Instant now = clock.instant();
        FirmMembership membership = invitationMembership(firmId, email, displayName, request.role(), now);
        actions.findFirstByTypeAndFirmIdAndTargetEmailAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                AccessActionType.INVITATION, firmId, email).ifPresent(action -> action.revoke(now));
        actions.flush();
        String rawToken = newToken();
        AccessAction action = new AccessAction(UUID.randomUUID(), firmId, membership.id(), membership.userId(),
                AccessActionType.INVITATION, email, new AccessAction.TokenHash(hash(rawToken)), actorId, now);
        actions.save(action);
        recordInvitationAction(action, actorId, membership, "membership.invited", origin);
        return generatedLink(action, "/invite/", rawToken);
    }

    @Transactional
    public GeneratedAccessLink createPasswordReset(UUID actorId, UUID firmId, UUID membershipId) {
        ActiveTarget target = requireActiveTargetForManagement(firmId, membershipId);
        serializeIssuance("password-reset:" + target.user().id());
        Instant now = clock.instant();
        actions.findFirstByTypeAndUserIdAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                AccessActionType.PASSWORD_RESET, target.user().id()).ifPresent(action -> action.revoke(now));
        actions.flush();
        String rawToken = newToken();
        AccessAction action = new AccessAction(UUID.randomUUID(), firmId, membershipId, target.user().id(),
                AccessActionType.PASSWORD_RESET, normalizeEmail(target.user().email()),
                new AccessAction.TokenHash(hash(rawToken)), actorId, now);
        actions.save(action);
        recordPasswordResetAction(action, actorId, target.membership(), "platform.password-reset.generated");
        return generatedLink(action, "/reset/", rawToken);
    }

    @Transactional
    public GeneratedAccessLink reissueInvitation(UUID firmId, UUID actorId, UUID membershipId) {
        return reissueInvitation(firmId, actorId, membershipId, AccessManagementOrigin.FIRM);
    }

    @Transactional
    public GeneratedAccessLink reissueInvitation(UUID firmId, UUID actorId, UUID membershipId,
            AccessManagementOrigin origin) {
        requireActiveFirmForManagement(firmId);
        FirmMembership membership = memberships.findByIdAndFirmId(membershipId, firmId)
                .filter(candidate -> candidate.status() == MembershipStatus.INVITED)
                .orElseThrow(AccessLifecycleService::invalidAction);
        String email = normalizeEmail(membership.invitationEmail());
        serializeIssuance("invitation:" + firmId + ":" + email);
        Instant now = clock.instant();
        actions.findFirstByTypeAndFirmIdAndTargetEmailAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                AccessActionType.INVITATION, firmId, email).ifPresent(action -> action.revoke(now));
        actions.flush();
        String rawToken = newToken();
        AccessAction replacement = new AccessAction(UUID.randomUUID(), firmId, membership.id(), membership.userId(),
                AccessActionType.INVITATION, email, new AccessAction.TokenHash(hash(rawToken)), actorId, now);
        actions.save(replacement);
        recordInvitationAction(replacement, actorId, membership, "membership.invitation-reissued", origin);
        return generatedLink(replacement, "/invite/", rawToken);
    }

    @Transactional
    public void revokeInvitation(UUID firmId, UUID actorId, UUID membershipId) {
        revokeInvitation(firmId, actorId, membershipId, AccessManagementOrigin.FIRM);
    }

    @Transactional
    public void revokeInvitation(UUID firmId, UUID actorId, UUID membershipId, AccessManagementOrigin origin) {
        requireFirm(firmId);
        FirmMembership membership = memberships.findByIdAndFirmId(membershipId, firmId)
                .filter(candidate -> candidate.status() == MembershipStatus.INVITED)
                .orElseThrow(AccessLifecycleService::invalidAction);
        AccessAction invitation = actions
                .findFirstByTypeAndFirmIdAndMembershipIdAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                        AccessActionType.INVITATION, firmId, membershipId)
                .orElseThrow(AccessLifecycleService::invalidAction);
        invitation.revoke(clock.instant());
        recordInvitationAction(invitation, actorId, membership, "membership.invitation-revoked", origin);
    }

    @Transactional
    public void acceptNewAccountInvitation(AcceptInvitationRequest request) {
        requireValidPassword(request.password());
        normalizeDisplayName(request.displayName());
        AccessAction invitation = redeem(request.token(), AccessActionType.INVITATION);
        FirmMembership membership = requireInvitedTarget(invitation);
        String email = normalizeEmail(invitation.targetEmail());
        if (users.existsByEmail(email))
            throw new DuplicateIdentityException("An account with this email already exists");
        Instant now = clock.instant();
        String displayName = membership.invitationDisplayName() == null
                ? normalizeDisplayName(request.displayName()) : membership.invitationDisplayName();
        ForgeBoardUser user = new ForgeBoardUser(UUID.randomUUID(), email, displayName,
                passwords.encode(request.password()), now);
        users.save(user);
        activateInvitation(invitation, membership, user.id(), now);
        recordInvitationAcceptance(invitation, membership, user.id());
    }

    @Transactional
    public void acceptExistingAccountInvitation(UUID authenticatedUserId, AcceptInvitationRequest request) {
        AccessAction invitation = redeem(request.token(), AccessActionType.INVITATION);
        FirmMembership membership = requireInvitedTarget(invitation);
        ForgeBoardUser authenticatedUser = users.findById(authenticatedUserId)
                .filter(ForgeBoardUser::enabled)
                .orElseThrow(() -> new AccessDeniedException("Authenticated account is not active"));
        if (!normalizeEmail(authenticatedUser.email()).equals(normalizeEmail(invitation.targetEmail()))
                || (membership.userId() != null && !membership.userId().equals(authenticatedUser.id())))
            throw new AccessDeniedException("Invitation is not for the authenticated account");
        Instant now = clock.instant();
        activateInvitation(invitation, membership, authenticatedUser.id(), now);
        recordInvitationAcceptance(invitation, membership, authenticatedUser.id());
    }

    /** Resolves the bearer-authenticated identity without requiring tenant context. */
    @Transactional
    public void acceptExistingAccountInvitation(String authenticatedEmail, AcceptInvitationRequest request) {
        ForgeBoardUser authenticatedUser = users.findByEmail(normalizeEmail(authenticatedEmail))
                .filter(ForgeBoardUser::enabled)
                .orElseThrow(() -> new AccessDeniedException("Authenticated account is not active"));
        acceptExistingAccountInvitation(authenticatedUser.id(), request);
    }

    @Transactional
    public void completePasswordReset(UUID actorId, CompletePasswordResetRequest request) {
        requireValidPassword(request.password());
        AccessAction reset = redeem(request.token(), AccessActionType.PASSWORD_RESET);
        ActiveTarget target = requireActiveTarget(reset);
        Instant now = clock.instant();
        target.user().changePassword(passwords.encode(request.password()), now);
        reset.consume(now);
        tokens.revokeAllForUser(target.user().id());
        recordPasswordResetAction(reset, actorId == null ? target.user().id() : actorId, target.membership(),
                "password-reset.completed");
    }

    private FirmMembership invitationMembership(UUID firmId, String email, String displayName, MembershipRole role,
            Instant now) {
        var existingUser = users.findByEmail(email);
        if (existingUser.isPresent()) {
            var existingMembership = memberships.findByFirmIdAndUserId(firmId, existingUser.get().id());
            if (existingMembership.isPresent()) {
                FirmMembership membership = existingMembership.get();
                if (membership.status() != MembershipStatus.REMOVED)
                    throw new DuplicateIdentityException("Account already belongs to this firm");
                membership.reinvite(email, displayName, role, now);
                return membership;
            }
        }
        var pending = memberships.findByFirmIdAndInvitationEmailAndStatus(firmId, email, MembershipStatus.INVITED);
        if (pending.isPresent()) {
            pending.get().updateInvitation(email, displayName, role, now);
            return pending.get();
        }
        return memberships.save(FirmMembership.invited(UUID.randomUUID(), firmId, email, displayName, role, now));
    }

    private AccessAction redeem(String token, AccessActionType expectedType) {
        String tokenHash = hash(token);
        var scope = actions.findScopeByTokenHash(tokenHash)
                .filter(candidate -> candidate.type() == expectedType && candidate.firmId() != null)
                .orElseThrow(AccessLifecycleService::invalidAction);
        requireActiveFirmForRedemption(scope.firmId());
        AccessAction action = actions.findByTokenHashForUpdate(tokenHash)
                .orElseThrow(AccessLifecycleService::invalidAction);
        if (action.type() != expectedType || !action.isRedeemable(clock.instant())
                || !scope.firmId().equals(action.firmId()))
            throw invalidAction();
        return action;
    }

    private void serializeIssuance(String scope) {
        String lockKey = hash(scope);
        actions.createSerializationLock(lockKey);
        actions.lockSerializationKey(lockKey);
    }

    private FirmMembership requireInvitedTarget(AccessAction invitation) {
        FirmMembership membership = memberships.findByIdAndFirmId(invitation.membershipId(), invitation.firmId())
                .filter(candidate -> candidate.status() == MembershipStatus.INVITED)
                .orElseThrow(AccessLifecycleService::invalidAction);
        if (!normalizeEmail(invitation.targetEmail()).equals(normalizeEmail(membership.invitationEmail())))
            throw invalidAction();
        return membership;
    }

    private ActiveTarget requireActiveTargetForManagement(UUID firmId, UUID membershipId) {
        requireActiveFirmForManagement(firmId);
        FirmMembership membership = memberships.findByIdAndFirmId(membershipId, firmId)
                .filter(candidate -> candidate.status() == MembershipStatus.ACTIVE && candidate.userId() != null)
                .orElseThrow(() -> new InvalidIdentityException("Password reset target is not active"));
        ForgeBoardUser user = users.findById(membership.userId()).filter(ForgeBoardUser::enabled)
                .orElseThrow(() -> new InvalidIdentityException("Password reset target is not active"));
        return new ActiveTarget(membership, user);
    }

    private ActiveTarget requireActiveTarget(AccessAction reset) {
        if (reset.firmId() == null || reset.membershipId() == null || reset.userId() == null)
            throw invalidAction();
        FirmMembership membership = memberships.findByIdAndFirmId(reset.membershipId(), reset.firmId())
                .filter(candidate -> candidate.status() == MembershipStatus.ACTIVE)
                .filter(candidate -> reset.userId().equals(candidate.userId()))
                .orElseThrow(AccessLifecycleService::invalidAction);
        ForgeBoardUser user = users.findById(reset.userId()).filter(ForgeBoardUser::enabled)
                .orElseThrow(AccessLifecycleService::invalidAction);
        if (!normalizeEmail(user.email()).equals(normalizeEmail(reset.targetEmail())))
            throw invalidAction();
        return new ActiveTarget(membership, user);
    }

    private void activateInvitation(AccessAction invitation, FirmMembership membership, UUID userId, Instant now) {
        membership.activate(userId, now);
        invitation.bindUser(userId);
        invitation.consume(now);
    }

    private void recordInvitationAcceptance(AccessAction invitation, FirmMembership membership, UUID actorId) {
        audit.recordUserAction(invitation.firmId(), actorId, ActivitySource.REST, "membership.invitation-accepted",
                "access-action", invitation.id(),
                Map.of("role", membership.role().name(), "status", membership.status().name()));
    }

    private void recordPasswordResetAction(AccessAction reset, UUID actorId, FirmMembership membership, String action) {
        audit.recordUserAction(reset.firmId(), actorId, ActivitySource.REST, action, "access-action", reset.id(),
                Map.of("role", membership.role().name(), "status", membership.status().name(),
                        "origin", action.startsWith("platform.") ? "PLATFORM" : "RECIPIENT"));
    }

    private void recordInvitationAction(AccessAction invitation, UUID actorId, FirmMembership membership, String action,
            AccessManagementOrigin origin) {
        String visibleAction = origin == AccessManagementOrigin.PLATFORM ? "platform." + action : action;
        audit.recordUserAction(invitation.firmId(), actorId, ActivitySource.REST, visibleAction, "access-action",
                invitation.id(), Map.of("role", membership.role().name(), "status", membership.status().name(),
                        "origin", origin.name()));
    }

    private Firm requireFirm(UUID firmId) {
        return firms.findByIdForUpdate(firmId).orElseThrow(AccessLifecycleService::invalidAction);
    }

    private void requireActiveFirmForManagement(UUID firmId) {
        if (requireFirm(firmId).status() != FirmStatus.ACTIVE)
            throw new InvalidIdentityException("Firm is not active");
    }

    private void requireActiveFirmForRedemption(UUID firmId) {
        if (requireFirm(firmId).status() != FirmStatus.ACTIVE) throw invalidAction();
    }

    private GeneratedAccessLink generatedLink(AccessAction action, String path, String rawToken) {
        URI link = publicAppUrl.resolve(path.substring(1) + rawToken);
        return new GeneratedAccessLink(action.id(), link.toString(), action.expiresAt());
    }

    private static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String token) {
        if (token == null || token.isBlank()) throw invalidAction();
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private static String normalizeEmail(String email) {
        if (email == null || email.isBlank()) throw new InvalidIdentityException("Email is invalid");
        return email.strip().toLowerCase(Locale.ROOT);
    }

    private static String normalizeDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank())
            throw new InvalidIdentityException("Display name is invalid");
        String normalized = displayName.strip();
        if (normalized.length() > DISPLAY_NAME_MAX_LENGTH)
            throw new InvalidIdentityException("Display name is invalid");
        return normalized;
    }

    private static void requireValidPassword(String password) {
        if (password == null || password.isBlank() || password.length() < PASSWORD_MIN_LENGTH
                || password.length() > PASSWORD_MAX_LENGTH)
            throw invalidAction();
    }

    private static InvalidIdentityException invalidAction() {
        return new InvalidIdentityException("Access action is invalid or expired");
    }

    private static URI validatePublicAppUrl(String configured) {
        final URI url;
        try {
            url = URI.create(configured == null ? "" : configured.strip());
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("FORGEBOARD_PUBLIC_APP_URL must be a valid absolute URL", exception);
        }
        String host = url.getHost();
        boolean local = "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host) || "::1".equals(host);
        if (!url.isAbsolute() || host == null || url.getUserInfo() != null || url.getRawQuery() != null
                || url.getRawFragment() != null || !("https".equalsIgnoreCase(url.getScheme())
                        || (local && "http".equalsIgnoreCase(url.getScheme()))))
            throw new IllegalStateException("FORGEBOARD_PUBLIC_APP_URL must use HTTPS outside local development");
        String path = url.getPath() == null || url.getPath().isEmpty() ? "/"
                : url.getPath() + (url.getPath().endsWith("/") ? "" : "/");
        return URI.create(url.getScheme() + "://" + url.getAuthority() + path);
    }

    private record ActiveTarget(FirmMembership membership, ForgeBoardUser user) { }
}
