package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.InOrder;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.forgeboard.identity.domain.AccessAction;
import com.forgeboard.identity.domain.AccessActionType;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.persistence.AccessActionRepository;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.UserRepository;
import com.forgeboard.identity.security.ApiTokenService;

@ExtendWith(MockitoExtension.class)
class AccessLifecycleServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-07T10:30:00Z");

    @Mock AccessActionRepository actions;
    @Mock FirmMembershipRepository memberships;
    @Mock UserRepository users;
    @Mock PasswordEncoder passwords;
    @Mock ApiTokenService tokens;
    @Mock ActivityAuditService audit;

    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void acceptsNewAccountInvitationByCreatingTheUserAndActivatingTheInvitedMembership() {
        UUID firmId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        AccessAction invitation = invitation(firmId, membershipId, "new.member@example.com", "new-account-token");
        FirmMembership membership = FirmMembership.invited(membershipId, firmId, MembershipRole.MEMBER, NOW);
        when(actions.findByTokenHashForUpdate(hash("new-account-token"))).thenReturn(Optional.of(invitation));
        when(memberships.findByIdAndFirmId(membershipId, firmId)).thenReturn(Optional.of(membership));
        when(users.existsByEmail("new.member@example.com")).thenReturn(false);
        when(passwords.encode("correct horse battery staple")).thenReturn("encoded-password");

        service().acceptNewAccountInvitation(new AcceptInvitationRequest("new-account-token", " New Member ",
                "correct horse battery staple"));

        ArgumentCaptor<ForgeBoardUser> user = ArgumentCaptor.forClass(ForgeBoardUser.class);
        verify(users).save(user.capture());
        assertThat(user.getValue().email()).isEqualTo("new.member@example.com");
        assertThat(user.getValue().displayName()).isEqualTo("New Member");
        assertThat(user.getValue().passwordHash()).isEqualTo("encoded-password");
        assertThat(membership.userId()).isEqualTo(user.getValue().id());
        assertThat(membership.status()).isEqualTo(MembershipStatus.ACTIVE);
        assertThat(invitation.consumedAt()).isEqualTo(NOW);
    }

    @Test
    void acceptsExistingAccountInvitationOnlyForTheNormalizedTargetEmail() {
        UUID firmId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        AccessAction invitation = invitation(firmId, membershipId, "existing.member@example.com", "existing-account-token");
        FirmMembership membership = FirmMembership.invited(membershipId, firmId, MembershipRole.MANAGER, NOW);
        ForgeBoardUser authenticatedUser = new ForgeBoardUser(userId, "Existing.Member@Example.com", "Existing", "hash", NOW);
        when(actions.findByTokenHashForUpdate(hash("existing-account-token"))).thenReturn(Optional.of(invitation));
        when(memberships.findByIdAndFirmId(membershipId, firmId)).thenReturn(Optional.of(membership));
        when(users.findById(userId)).thenReturn(Optional.of(authenticatedUser));

        service().acceptExistingAccountInvitation(userId, new AcceptInvitationRequest("existing-account-token"));

        assertThat(membership.userId()).isEqualTo(userId);
        assertThat(membership.status()).isEqualTo(MembershipStatus.ACTIVE);
        assertThat(invitation.consumedAt()).isEqualTo(NOW);
    }

    @Test
    void deniesExistingAccountAcceptanceWhenTheAuthenticatedEmailDoesNotMatch() {
        UUID firmId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        AccessAction invitation = invitation(firmId, membershipId, "intended@example.com", "mismatch-token");
        ForgeBoardUser authenticatedUser = new ForgeBoardUser(userId, "other@example.com", "Other", "hash", NOW);
        when(actions.findByTokenHashForUpdate(hash("mismatch-token"))).thenReturn(Optional.of(invitation));
        when(users.findById(userId)).thenReturn(Optional.of(authenticatedUser));

        assertThatThrownBy(() -> service().acceptExistingAccountInvitation(userId,
                new AcceptInvitationRequest("mismatch-token")))
                .isInstanceOf(AccessDeniedException.class);

        verify(memberships, never()).findByIdAndFirmId(any(), any());
        assertThat(invitation.consumedAt()).isNull();
    }

    @Test
    void reissueRevokesTheEarlierInvitationAndPersistsOnlyTheNewDigest() {
        UUID firmId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        FirmMembership invitedMembership = FirmMembership.invited(membershipId, firmId, MembershipRole.MEMBER, NOW);
        AccessAction prior = invitation(firmId, membershipId, "invitee@example.com", "prior-token");
        when(actions.findFirstByTypeAndFirmIdAndTargetEmailAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                AccessActionType.INVITATION, firmId, "invitee@example.com")).thenReturn(Optional.of(prior));
        when(memberships.findByIdAndFirmId(membershipId, firmId)).thenReturn(Optional.of(invitedMembership));

        GeneratedAccessLink generated = service().createInvitation(firmId, actorId,
                new InviteMemberRequest(" INVITEE@EXAMPLE.COM ", MembershipRole.MANAGER));

        ArgumentCaptor<AccessAction> replacement = ArgumentCaptor.forClass(AccessAction.class);
        verify(actions).save(replacement.capture());
        assertThat(prior.revokedAt()).isEqualTo(NOW);
        assertThat(replacement.getValue().membershipId()).isEqualTo(membershipId);
        assertThat(replacement.getValue().tokenHash().value()).doesNotContain("prior-token");
        assertThat(generated.link()).startsWith("https://pilot.forgeboard.example/invite/");
        assertThat(generated.link()).doesNotContain(replacement.getValue().tokenHash().value());
        assertThat(generated.expiresAt()).isEqualTo(NOW.plus(AccessAction.TOKEN_LIFETIME));
        String lockKey = hash("invitation:" + firmId + ":invitee@example.com");
        InOrder serialization = inOrder(actions);
        serialization.verify(actions).createSerializationLock(lockKey);
        serialization.verify(actions).lockSerializationKey(lockKey);
        serialization.verify(actions).findFirstByTypeAndFirmIdAndTargetEmailAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                AccessActionType.INVITATION, firmId, "invitee@example.com");
    }

    @Test
    void serializesPasswordResetReissueBeforeItLooksForThePriorAction() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        ForgeBoardUser user = new ForgeBoardUser(userId, "member@example.com", "Member", "hash", NOW);
        AccessAction prior = passwordReset(userId, "member@example.com", "prior-reset-token");
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(actions.findFirstByTypeAndUserIdAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                AccessActionType.PASSWORD_RESET, userId)).thenReturn(Optional.of(prior));
        when(memberships.findAllByUserId(userId)).thenReturn(List.of());

        GeneratedAccessLink generated = service().createPasswordReset(actorId, userId);

        assertThat(prior.revokedAt()).isEqualTo(NOW);
        assertThat(generated.link()).startsWith("https://pilot.forgeboard.example/reset/");
        String lockKey = hash("password-reset:" + userId);
        InOrder serialization = inOrder(actions);
        serialization.verify(actions).createSerializationLock(lockKey);
        serialization.verify(actions).lockSerializationKey(lockKey);
        serialization.verify(actions).findFirstByTypeAndUserIdAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
                AccessActionType.PASSWORD_RESET, userId);
    }

    @Test
    void rejectsAResetActionAtTheInvitationAcceptanceBoundary() {
        AccessAction reset = passwordReset(UUID.randomUUID(), "member@example.com", "reset-token");
        when(actions.findByTokenHashForUpdate(hash("reset-token"))).thenReturn(Optional.of(reset));

        assertThatThrownBy(() -> service().acceptNewAccountInvitation(new AcceptInvitationRequest("reset-token", "Member",
                "correct horse battery staple")))
                .isInstanceOf(InvalidIdentityException.class);

        assertThat(reset.consumedAt()).isNull();
    }

    @Test
    void completesPasswordResetAndRevokesEveryRefreshFamilyForTheUser() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        AccessAction reset = passwordReset(userId, "member@example.com", "reset-completion-token");
        ForgeBoardUser user = new ForgeBoardUser(userId, "member@example.com", "Member", "old-hash", NOW);
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), UUID.randomUUID(), userId,
                MembershipRole.MEMBER, NOW);
        when(actions.findByTokenHashForUpdate(hash("reset-completion-token"))).thenReturn(Optional.of(reset));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(passwords.encode("new secure password")).thenReturn("new-hash");
        when(memberships.findAllByUserId(userId)).thenReturn(List.of(membership));

        service().completePasswordReset(actorId, new CompletePasswordResetRequest("reset-completion-token", "new secure password"));

        assertThat(user.passwordHash()).isEqualTo("new-hash");
        assertThat(reset.consumedAt()).isEqualTo(NOW);
        verify(tokens).revokeAllForUser(userId);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> summary = ArgumentCaptor.forClass(Map.class);
        verify(audit).recordUserAction(eq(membership.firmId()), eq(actorId), any(), eq("password-reset.completed"),
                eq("access-action"), eq(reset.id()), summary.capture());
        assertThat(summary.getValue()).containsExactlyInAnyOrderEntriesOf(Map.of("role", "MEMBER", "status", "ACTIVE"));
        assertThat(summary.getValue().values()).doesNotContain("reset-completion-token", hash("reset-completion-token"));
    }

    @Test
    void publicPasswordResetRecordsTheResetAccountAsTheAuditActor() {
        UUID userId = UUID.randomUUID();
        AccessAction reset = passwordReset(userId, "member@example.com", "public-reset-token");
        ForgeBoardUser user = new ForgeBoardUser(userId, "member@example.com", "Member", "old-hash", NOW);
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), UUID.randomUUID(), userId,
                MembershipRole.MEMBER, NOW);
        when(actions.findByTokenHashForUpdate(hash("public-reset-token"))).thenReturn(Optional.of(reset));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(passwords.encode("new secure password")).thenReturn("new-hash");
        when(memberships.findAllByUserId(userId)).thenReturn(List.of(membership));

        service().completePasswordReset(null, new CompletePasswordResetRequest("public-reset-token", "new secure password"));

        verify(audit).recordUserAction(eq(membership.firmId()), eq(userId), any(), eq("password-reset.completed"),
                eq("access-action"), eq(reset.id()), any());
    }

    private AccessLifecycleService service() {
        return new AccessLifecycleService(actions, memberships, users, passwords, tokens, audit, clock,
                "https://pilot.forgeboard.example");
    }

    private static AccessAction invitation(UUID firmId, UUID membershipId, String email, String token) {
        return new AccessAction(UUID.randomUUID(), firmId, membershipId, null, AccessActionType.INVITATION, email,
                new AccessAction.TokenHash(hash(token)), UUID.randomUUID(), NOW);
    }

    private static AccessAction passwordReset(UUID userId, String email, String token) {
        return new AccessAction(UUID.randomUUID(), null, null, userId, AccessActionType.PASSWORD_RESET, email,
                new AccessAction.TokenHash(hash(token)), UUID.randomUUID(), NOW);
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }
}
