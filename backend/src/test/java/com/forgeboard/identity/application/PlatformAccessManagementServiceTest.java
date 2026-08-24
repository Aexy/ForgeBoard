package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.persistence.AccessActionRepository;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class PlatformAccessManagementServiceTest {
    @Mock PlatformAdminPolicy policy;
    @Mock FirmRepository firms;
    @Mock FirmMembershipRepository memberships;
    @Mock UserRepository users;
    @Mock AccessActionRepository actions;
    @Mock AccessLifecycleService lifecycle;
    @Mock ActivityAuditService audit;

    @Test
    void platformAdministratorCanGenerateAPasswordResetOnlyForTheSelectedActiveMembership() {
        ForgeBoardUser administrator = user("admin@example.com");
        UUID firmId = UUID.randomUUID();
        FirmMembership target = new FirmMembership(UUID.randomUUID(), firmId, UUID.randomUUID(), MembershipRole.MEMBER,
                Instant.parse("2026-08-07T10:00:00Z"));
        GeneratedAccessLink reset = new GeneratedAccessLink(UUID.randomUUID(), "https://app.example/reset/token",
                Instant.parse("2026-08-14T10:00:00Z"));
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(administrator));
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(firm(firmId)));
        when(memberships.findByIdAndFirmId(target.id(), firmId)).thenReturn(Optional.of(target));
        when(users.findById(target.userId())).thenReturn(Optional.of(user("member@example.com")));
        when(lifecycle.createPasswordReset(administrator.id(), firmId, target.id())).thenReturn(reset);

        GeneratedAccessLink result = service().createPasswordReset(actor(), firmId, target.id());

        assertThat(result).isSameAs(reset);
        verify(lifecycle).createPasswordReset(administrator.id(), firmId, target.id());
    }

    @Test
    void platformAdministratorCannotGenerateAResetForASuspendedMembership() {
        UUID firmId = UUID.randomUUID();
        FirmMembership target = new FirmMembership(UUID.randomUUID(), firmId, UUID.randomUUID(), MembershipRole.MEMBER,
                Instant.parse("2026-08-07T10:00:00Z"));
        target.suspend(Instant.parse("2026-08-07T10:00:01Z"));
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(user("admin@example.com")));
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(firm(firmId)));
        when(memberships.findByIdAndFirmId(target.id(), firmId)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service().createPasswordReset(actor(), firmId, target.id()))
                .isInstanceOf(InvalidIdentityException.class);

        verify(lifecycle, never()).createPasswordReset(any(), any(), any());
    }

    @Test
    void platformAdministratorCannotGenerateAResetForADisabledUser() {
        UUID firmId = UUID.randomUUID();
        FirmMembership target = new FirmMembership(UUID.randomUUID(), firmId, UUID.randomUUID(), MembershipRole.MEMBER,
                Instant.parse("2026-08-07T10:00:00Z"));
        ForgeBoardUser disabled = mock(ForgeBoardUser.class);
        when(disabled.enabled()).thenReturn(false);
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(user("admin@example.com")));
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(firm(firmId)));
        when(memberships.findByIdAndFirmId(target.id(), firmId)).thenReturn(Optional.of(target));
        when(users.findById(target.userId())).thenReturn(Optional.of(disabled));

        assertThatThrownBy(() -> service().createPasswordReset(actor(), firmId, target.id()))
                .isInstanceOf(InvalidIdentityException.class);

        verify(lifecycle, never()).createPasswordReset(any(), any(), any());
    }

    @Test
    void platformAdministratorCannotSuspendMembershipOutsideThePathFirm() {
        UUID firmId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(user("admin@example.com")));
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(firm(firmId)));
        when(memberships.findByIdAndFirmId(membershipId, firmId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().suspend(actor(), firmId, membershipId))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
        verify(memberships, never()).countByFirmIdAndRoleAndStatus(any(), any(), any());
    }

    @Test
    void platformAdministratorCannotRemoveTheFinalActiveOwner() {
        UUID firmId = UUID.randomUUID();
        FirmMembership owner = new FirmMembership(UUID.randomUUID(), firmId, UUID.randomUUID(), MembershipRole.OWNER,
                Instant.parse("2026-08-07T10:00:00Z"));
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(user("admin@example.com")));
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(firm(firmId)));
        when(memberships.findByIdAndFirmId(owner.id(), firmId)).thenReturn(Optional.of(owner));
        when(memberships.countByFirmIdAndRoleAndStatus(firmId, MembershipRole.OWNER, MembershipStatus.ACTIVE))
                .thenReturn(1L);

        assertThatThrownBy(() -> service().remove(actor(), firmId, owner.id()))
                .isInstanceOf(PlatformAdministrationConflictException.class);
    }

    @Test
    void platformInvitationIssuanceLocksTheFirmBeforeTheLifecycleCanChangeAnExistingInviteRole() {
        UUID firmId = UUID.randomUUID();
        ForgeBoardUser administrator = user("admin@example.com");
        GeneratedAccessLink link = new GeneratedAccessLink(UUID.randomUUID(), "https://app.example/invite/token",
                Instant.parse("2026-08-14T10:00:00Z"));
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(administrator));
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(firm(firmId)));
        when(lifecycle.createInvitation(firmId, administrator.id(),
                new InviteMemberRequest("Mira", "mira@example.com", MembershipRole.OWNER),
                AccessManagementOrigin.PLATFORM)).thenReturn(link);

        assertThat(service().invite(actor(), firmId, new InviteMemberRequest("Mira", "mira@example.com", MembershipRole.OWNER)))
                .isSameAs(link);

        var order = inOrder(firms, lifecycle);
        order.verify(firms).findByIdForUpdate(firmId);
        order.verify(lifecycle).createInvitation(firmId, administrator.id(),
                new InviteMemberRequest("Mira", "mira@example.com", MembershipRole.OWNER),
                AccessManagementOrigin.PLATFORM);
    }

    @Test
    void removedMembershipCannotBeReactivatedByPlatformAdministration() {
        UUID firmId = UUID.randomUUID();
        FirmMembership removed = new FirmMembership(UUID.randomUUID(), firmId, UUID.randomUUID(), MembershipRole.MEMBER,
                Instant.parse("2026-08-07T10:00:00Z"));
        removed.remove(Instant.parse("2026-08-07T10:00:01Z"));
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(user("admin@example.com")));
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(firm(firmId)));
        when(memberships.findByIdAndFirmId(removed.id(), firmId)).thenReturn(Optional.of(removed));

        assertThatThrownBy(() -> service().reactivate(actor(), firmId, removed.id()))
                .isInstanceOf(InvalidIdentityException.class);
        assertThat(removed.status()).isEqualTo(MembershipStatus.REMOVED);
        verify(audit, never()).recordUserAction(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void removedMembershipCannotBeSuspendedOrHaveItsRoleChangedByPlatformAdministration() {
        UUID firmId = UUID.randomUUID();
        FirmMembership removed = new FirmMembership(UUID.randomUUID(), firmId, UUID.randomUUID(), MembershipRole.MEMBER,
                Instant.parse("2026-08-07T10:00:00Z"));
        removed.remove(Instant.parse("2026-08-07T10:00:01Z"));
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(user("admin@example.com")));
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(firm(firmId)));
        when(memberships.findByIdAndFirmId(removed.id(), firmId)).thenReturn(Optional.of(removed));

        assertThatThrownBy(() -> service().suspend(actor(), firmId, removed.id()))
                .isInstanceOf(InvalidIdentityException.class);
        assertThatThrownBy(() -> service().updateRole(actor(), firmId, removed.id(),
                new UpdateMembershipRoleRequest(MembershipRole.ADMINISTRATOR))).isInstanceOf(InvalidIdentityException.class);

        assertThat(removed.status()).isEqualTo(MembershipStatus.REMOVED);
        assertThat(removed.role()).isEqualTo(MembershipRole.MEMBER);
        verify(audit, never()).recordUserAction(any(), any(), any(), any(), any(), any(), any());
    }

    private PlatformAccessManagementService service() {
        return new PlatformAccessManagementService(policy, firms, memberships, users, actions, lifecycle, audit,
                Clock.fixed(Instant.parse("2026-08-07T10:00:00Z"), ZoneOffset.UTC));
    }

    private Authentication actor() {
        return new UsernamePasswordAuthenticationToken("admin@example.com", "not-used");
    }

    private ForgeBoardUser user(String email) {
        return new ForgeBoardUser(UUID.randomUUID(), email, "Admin", "hash", Instant.parse("2026-08-07T10:00:00Z"));
    }

    private Firm firm(UUID firmId) {
        return new Firm(firmId, "Northstar", "northstar", Instant.parse("2026-08-07T10:00:00Z"));
    }
}
