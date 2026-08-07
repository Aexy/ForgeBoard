package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
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
import org.springframework.security.access.AccessDeniedException;

import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.persistence.AccessActionRepository;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class FirmAccessManagementServiceTest {
    @Mock TenantAuthorizationService policy;
    @Mock FirmRepository firms;
    @Mock FirmMembershipRepository memberships;
    @Mock UserRepository users;
    @Mock AccessActionRepository actions;
    @Mock AccessLifecycleService lifecycle;
    @Mock ActivityAuditService audit;

    @Test
    void administratorCannotInviteAnOwner() {
        SelectedTenant administrator = tenant(MembershipRole.ADMINISTRATOR);

        assertThatThrownBy(() -> service().invite(administrator,
                new InviteMemberRequest("Olivia Owner", "olivia@example.com", MembershipRole.OWNER)))
                .isInstanceOf(AccessDeniedException.class);

        verify(lifecycle, never()).createInvitation(any(), any(), any());
    }

    @Test
    void administratorCannotPromoteAMembershipToOwner() {
        SelectedTenant administrator = tenant(MembershipRole.ADMINISTRATOR);
        FirmMembership member = membership(administrator.firmId(), MembershipRole.MEMBER, MembershipStatus.ACTIVE);
        when(firms.findByIdForUpdate(administrator.firmId())).thenReturn(Optional.of(firm(administrator.firmId())));
        when(memberships.findByIdAndFirmId(member.id(), administrator.firmId())).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> service().updateRole(administrator, member.id(),
                new UpdateMembershipRoleRequest(MembershipRole.OWNER)))
                .isInstanceOf(AccessDeniedException.class);

        verify(memberships, never()).countByFirmIdAndRoleAndStatus(any(), any(), any());
    }

    @Test
    void cannotDemoteTheFinalActiveOwner() {
        SelectedTenant owner = tenant(MembershipRole.OWNER);
        FirmMembership finalOwner = membership(owner.firmId(), MembershipRole.OWNER, MembershipStatus.ACTIVE);
        when(firms.findByIdForUpdate(owner.firmId())).thenReturn(Optional.of(firm(owner.firmId())));
        when(memberships.findByIdAndFirmId(finalOwner.id(), owner.firmId())).thenReturn(Optional.of(finalOwner));
        when(memberships.countByFirmIdAndRoleAndStatus(owner.firmId(), MembershipRole.OWNER, MembershipStatus.ACTIVE))
                .thenReturn(1L);

        assertThatThrownBy(() -> service().updateRole(owner, finalOwner.id(),
                new UpdateMembershipRoleRequest(MembershipRole.ADMINISTRATOR)))
                .isInstanceOf(PlatformAdministrationConflictException.class);
    }

    @Test
    void doesNotManageAMembershipFromAnotherFirm() {
        SelectedTenant owner = tenant(MembershipRole.OWNER);
        UUID otherFirmId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        when(firms.findByIdForUpdate(owner.firmId())).thenReturn(Optional.of(firm(owner.firmId())));
        when(memberships.findByIdAndFirmId(membershipId, owner.firmId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().suspend(owner, membershipId))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
        verify(memberships, never()).countByFirmIdAndRoleAndStatus(otherFirmId, MembershipRole.OWNER,
                MembershipStatus.ACTIVE);
    }

    @Test
    void invitationIssuanceLocksTheFirmBeforeTheLifecycleCanChangeAnExistingInviteRole() {
        SelectedTenant owner = tenant(MembershipRole.OWNER);
        GeneratedAccessLink link = new GeneratedAccessLink(UUID.randomUUID(), "https://app.example/invite/token",
                Instant.parse("2026-08-14T10:00:00Z"));
        when(firms.findByIdForUpdate(owner.firmId())).thenReturn(Optional.of(firm(owner.firmId())));
        when(lifecycle.createInvitation(owner.firmId(), owner.userId(),
                new InviteMemberRequest("Mira", "mira@example.com", MembershipRole.OWNER))).thenReturn(link);

        assertThat(service().invite(owner, new InviteMemberRequest("Mira", "mira@example.com", MembershipRole.OWNER)))
                .isSameAs(link);

        var order = inOrder(firms, lifecycle);
        order.verify(firms).findByIdForUpdate(owner.firmId());
        order.verify(lifecycle).createInvitation(owner.firmId(), owner.userId(),
                new InviteMemberRequest("Mira", "mira@example.com", MembershipRole.OWNER));
    }

    @Test
    void removedMembershipCannotBeReactivated() {
        SelectedTenant owner = tenant(MembershipRole.OWNER);
        FirmMembership removed = membership(owner.firmId(), MembershipRole.MEMBER, MembershipStatus.ACTIVE);
        removed.remove(Instant.parse("2026-08-07T10:00:01Z"));
        when(firms.findByIdForUpdate(owner.firmId())).thenReturn(Optional.of(firm(owner.firmId())));
        when(memberships.findByIdAndFirmId(removed.id(), owner.firmId())).thenReturn(Optional.of(removed));

        assertThatThrownBy(() -> service().reactivate(owner, removed.id()))
                .isInstanceOf(InvalidIdentityException.class);
        assertThat(removed.status()).isEqualTo(MembershipStatus.REMOVED);
        verify(audit, never()).recordUserAction(any(), any(), any(), any(), any(), any(), any());
    }

    private FirmAccessManagementService service() {
        return new FirmAccessManagementService(policy, firms, memberships, users, actions, lifecycle, audit,
                Clock.fixed(Instant.parse("2026-08-07T10:00:00Z"), ZoneOffset.UTC));
    }

    private SelectedTenant tenant(MembershipRole role) {
        return new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "actor@example.com", role);
    }

    private Firm firm(UUID firmId) {
        return new Firm(firmId, "Northstar", "northstar", Instant.parse("2026-08-07T10:00:00Z"));
    }

    private FirmMembership membership(UUID firmId, MembershipRole role, MembershipStatus status) {
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), firmId, UUID.randomUUID(), role,
                Instant.parse("2026-08-07T10:00:00Z"));
        if (status == MembershipStatus.SUSPENDED) membership.suspend(Instant.parse("2026-08-07T10:00:01Z"));
        return membership;
    }
}
