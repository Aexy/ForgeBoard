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
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.persistence.AccessActionRepository;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.UserRepository;
import com.forgeboard.identity.security.ApiTokenService;

import jakarta.persistence.EntityNotFoundException;

/** Shared, one-time lifecycle for firm invitations and password-reset credentials. */
@Service
public class AccessLifecycleService {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AccessActionRepository actions;
    private final FirmMembershipRepository memberships;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final ApiTokenService tokens;
    private final ActivityAuditService audit;
    private final Clock clock;
    private final URI publicAppUrl;

    public AccessLifecycleService(AccessActionRepository actions, FirmMembershipRepository memberships,
            UserRepository users, PasswordEncoder passwords, ApiTokenService tokens, ActivityAuditService audit,
            Clock clock, @Value("${FORGEBOARD_PUBLIC_APP_URL:http://localhost:3000}") String publicAppUrl) {
        this.actions = actions;
        this.memberships = memberships;
        this.users = users;
        this.passwords = passwords;
        this.tokens = tokens;
        this.audit = audit;
        this.clock = clock;
        this.publicAppUrl = validatePublicAppUrl(publicAppUrl);
    }

    @Transactional
    public GeneratedAccessLink createInvitation(UUID firmId, UUID actorId, InviteMemberRequest request) {
        String email = normalizeEmail(request.email());
        serializeIssuance("invitation:" + firmId + ":" + email);
        Instant now = clock.instant();
        FirmMembership membership = actions.findFirstByTypeAndFirmIdAndTargetEmailAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                AccessActionType.INVITATION, firmId, email)
                .map(previous -> reissueInvitation(firmId, previous, request.role(), now))
                .orElseGet(() -> createInvitedMembership(firmId, email, request.role(), now));
        String rawToken = newToken();
        AccessAction action = new AccessAction(UUID.randomUUID(), firmId, membership.id(), null,
                AccessActionType.INVITATION, email, new AccessAction.TokenHash(hash(rawToken)), actorId, now);
        actions.save(action);
        audit.recordUserAction(firmId, actorId, ActivitySource.REST, "membership.invited", "access-action", action.id(),
                Map.of("role", membership.role().name(), "status", membership.status().name()));
        return generatedLink(action, "/invite/", rawToken);
    }

    @Transactional
    public GeneratedAccessLink createPasswordReset(UUID actorId, UUID userId) {
        ForgeBoardUser user = users.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User was not found"));
        serializeIssuance("password-reset:" + user.id());
        Instant now = clock.instant();
        actions.findFirstByTypeAndUserIdAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                AccessActionType.PASSWORD_RESET, userId).ifPresent(action -> action.revoke(now));
        String rawToken = newToken();
        AccessAction action = new AccessAction(UUID.randomUUID(), null, null, user.id(),
                AccessActionType.PASSWORD_RESET, normalizeEmail(user.email()), new AccessAction.TokenHash(hash(rawToken)),
                actorId, now);
        actions.save(action);
        recordPasswordResetAction(action, actorId, "password-reset.generated");
        return generatedLink(action, "/reset/", rawToken);
    }

    @Transactional
    public void acceptNewAccountInvitation(AcceptInvitationRequest request) {
        AccessAction invitation = redeem(request.token(), AccessActionType.INVITATION);
        if (request.displayName() == null || request.displayName().isBlank() || request.password() == null || request.password().isBlank())
            throw new InvalidIdentityException("New account invitation acceptance requires a name and password");
        String email = normalizeEmail(invitation.targetEmail());
        if (users.existsByEmail(email))
            throw new DuplicateIdentityException("An account with this email already exists");
        Instant now = clock.instant();
        ForgeBoardUser user = new ForgeBoardUser(UUID.randomUUID(), email, request.displayName().strip(),
                passwords.encode(request.password()), now);
        users.save(user);
        activateInvitation(invitation, user.id(), now);
        recordInvitationAcceptance(invitation, user.id());
    }

    @Transactional
    public void acceptExistingAccountInvitation(UUID authenticatedUserId, AcceptInvitationRequest request) {
        AccessAction invitation = redeem(request.token(), AccessActionType.INVITATION);
        ForgeBoardUser authenticatedUser = users.findById(authenticatedUserId)
                .filter(ForgeBoardUser::enabled)
                .orElseThrow(() -> new AccessDeniedException("Authenticated account is not active"));
        if (!normalizeEmail(authenticatedUser.email()).equals(normalizeEmail(invitation.targetEmail())))
            throw new AccessDeniedException("Invitation is not for the authenticated account");
        Instant now = clock.instant();
        activateInvitation(invitation, authenticatedUser.id(), now);
        recordInvitationAcceptance(invitation, authenticatedUser.id());
    }

    @Transactional
    public void completePasswordReset(UUID actorId, CompletePasswordResetRequest request) {
        AccessAction reset = redeem(request.token(), AccessActionType.PASSWORD_RESET);
        if (reset.userId() == null)
            throw new InvalidIdentityException("Password reset is invalid or expired");
        ForgeBoardUser user = users.findById(reset.userId())
                .orElseThrow(() -> new InvalidIdentityException("Password reset is invalid or expired"));
        user.changePassword(passwords.encode(request.password()), clock.instant());
        reset.consume(clock.instant());
        tokens.revokeAllForUser(user.id());
        recordPasswordResetAction(reset, actorId, "password-reset.completed");
    }

    private FirmMembership reissueInvitation(UUID firmId, AccessAction previous, MembershipRole role, Instant now) {
        previous.revoke(now);
        FirmMembership membership = memberships.findByIdAndFirmId(previous.membershipId(), firmId)
                .orElseThrow(() -> new InvalidIdentityException("Invitation is invalid"));
        if (membership.status() != MembershipStatus.INVITED)
            throw new InvalidIdentityException("Invitation is invalid");
        membership.changeRole(role, now);
        return membership;
    }

    private FirmMembership createInvitedMembership(UUID firmId, String email, MembershipRole role, Instant now) {
        users.findByEmail(email).ifPresent(user -> {
            if (memberships.existsByFirmIdAndUserId(firmId, user.id()))
                throw new DuplicateIdentityException("Account already belongs to this firm");
        });
        return memberships.save(FirmMembership.invited(UUID.randomUUID(), firmId, role, now));
    }

    private AccessAction redeem(String token, AccessActionType expectedType) {
        AccessAction action = actions.findByTokenHashForUpdate(hash(token))
                .orElseThrow(() -> new InvalidIdentityException("Access action is invalid or expired"));
        if (action.type() != expectedType || !action.isRedeemable(clock.instant()))
            throw new InvalidIdentityException("Access action is invalid or expired");
        return action;
    }

    private void serializeIssuance(String scope) {
        String lockKey = hash(scope);
        actions.createSerializationLock(lockKey);
        actions.lockSerializationKey(lockKey);
    }

    private void activateInvitation(AccessAction invitation, UUID userId, Instant now) {
        FirmMembership membership = memberships.findByIdAndFirmId(invitation.membershipId(), invitation.firmId())
                .filter(candidate -> candidate.status() == MembershipStatus.INVITED)
                .orElseThrow(() -> new InvalidIdentityException("Invitation is invalid or expired"));
        membership.activate(userId, now);
        invitation.consume(now);
    }

    private void recordInvitationAcceptance(AccessAction invitation, UUID actorId) {
        FirmMembership membership = memberships.findByIdAndFirmId(invitation.membershipId(), invitation.firmId())
                .orElseThrow(() -> new InvalidIdentityException("Invitation is invalid or expired"));
        audit.recordUserAction(invitation.firmId(), actorId, ActivitySource.REST, "membership.invitation-accepted",
                "access-action", invitation.id(), Map.of("role", membership.role().name(), "status", membership.status().name()));
    }

    private void recordPasswordResetAction(AccessAction reset, UUID actorId, String action) {
        memberships.findAllByUserId(reset.userId()).forEach(membership -> audit.recordUserAction(membership.firmId(), actorId,
                ActivitySource.REST, action, "access-action", reset.id(),
                Map.of("role", membership.role().name(), "status", membership.status().name())));
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
        if (token == null || token.isBlank()) throw new InvalidIdentityException("Access action is invalid or expired");
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
        String path = url.getPath() == null || url.getPath().isEmpty() ? "/" : url.getPath() + (url.getPath().endsWith("/") ? "" : "/");
        return URI.create(url.getScheme() + "://" + url.getAuthority() + path);
    }
}
