package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.FirmStatus;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class PlatformAdministrationServiceTest {
    @Mock PlatformAdminPolicy policy; @Mock FirmRepository firms; @Mock FirmMembershipRepository memberships;
    @Mock UserRepository users; @Mock PasswordEncoder passwords; @Mock ActivityAuditService audit;

    @Test
    void createsFirmAndInitialOwnerAtomicallyWithPlatformAudit() {
        Authentication actor = actor();
        ForgeBoardUser admin = user("admin@example.com");
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        when(firms.save(any())).thenAnswer(call -> call.getArgument(0));
        when(users.save(any())).thenAnswer(call -> call.getArgument(0));
        when(memberships.save(any())).thenAnswer(call -> call.getArgument(0));
        when(passwords.encode("correct horse battery staple")).thenReturn("hash");

        PlatformFirmView firm = service().createFirm(actor, new CreatePlatformFirmRequest("Northstar", "Northstar", "Nora Owner",
                "NORA@example.com", "correct horse battery staple"));

        assertThat(firm.slug()).isEqualTo("northstar");
        ArgumentCaptor<FirmMembership> membership = ArgumentCaptor.forClass(FirmMembership.class);
        verify(memberships).save(membership.capture());
        assertThat(membership.getValue().role()).isEqualTo(MembershipRole.OWNER);
        verify(audit).recordUserAction(eq(firm.id()), eq(admin.id()), any(), eq("platform.firm.created"), eq("firm"),
                eq(firm.id()), any());
    }

    @Test
    void rejectsCrossFirmMembershipWithoutAuditingOrChangingIt() {
        UUID firmId = UUID.randomUUID();
        UUID otherFirmId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(new Firm(firmId, "Northstar", "northstar", now())));
        FirmMembership otherMembership = new FirmMembership(membershipId, otherFirmId, UUID.randomUUID(), MembershipRole.MEMBER, now());
        when(memberships.findById(membershipId)).thenReturn(Optional.of(otherMembership));

        assertThatThrownBy(() -> service().suspendMembership(actor(), firmId, membershipId))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
        assertThat(otherMembership.status()).isEqualTo(MembershipStatus.ACTIVE);
        org.mockito.Mockito.verifyNoInteractions(audit);
    }

    @Test
    void cannotSuspendOrDemoteTheLastActiveOwner() {
        UUID firmId = UUID.randomUUID();
        FirmMembership owner = new FirmMembership(UUID.randomUUID(), firmId, UUID.randomUUID(), MembershipRole.OWNER, now());
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(new Firm(firmId, "Northstar", "northstar", now())));
        when(memberships.findById(owner.id())).thenReturn(Optional.of(owner));
        when(memberships.countByFirmIdAndRoleAndStatus(firmId, MembershipRole.OWNER, MembershipStatus.ACTIVE)).thenReturn(1L);

        assertThatThrownBy(() -> service().suspendMembership(actor(), firmId, owner.id()))
                .isInstanceOf(PlatformAdministrationConflictException.class);
        assertThatThrownBy(() -> service().updateRole(actor(), firmId, owner.id(), new UpdateMembershipRoleRequest(MembershipRole.ADMINISTRATOR)))
                .isInstanceOf(PlatformAdministrationConflictException.class);
        verify(firms, org.mockito.Mockito.times(2)).findByIdForUpdate(firmId);
    }

    @Test
    void suspendsFirmAndRecordsStablePlatformAction() {
        Authentication actor = actor();
        ForgeBoardUser admin = user("admin@example.com");
        UUID firmId = UUID.randomUUID();
        Firm firm = new Firm(firmId, "Northstar", "northstar", now());
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(firm));
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));

        PlatformFirmView view = service().suspendFirm(actor, firmId);

        assertThat(view.status()).isEqualTo(FirmStatus.SUSPENDED);
        verify(audit).recordUserAction(eq(firmId), eq(admin.id()), any(), eq("platform.firm.suspended"), eq("firm"), eq(firmId), any());
    }

    @Test
    void provisionsEmployeeAndReturnsOnlySafeMembershipFields() {
        UUID firmId = UUID.randomUUID();
        ForgeBoardUser admin = user("admin@example.com");
        when(firms.existsById(firmId)).thenReturn(true);
        when(users.existsByEmail("mira@example.com")).thenReturn(false);
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        when(users.save(any())).thenAnswer(call -> call.getArgument(0));
        when(memberships.save(any())).thenAnswer(call -> call.getArgument(0));
        when(passwords.encode(any())).thenReturn("hash");

        PlatformEmployeeView employee = service().createEmployee(actor(), firmId,
                new CreatePlatformEmployeeRequest("Mira Miller", "MIRA@example.com", "secure temporary password", MembershipRole.MEMBER));

        assertThat(employee.email()).isEqualTo("mira@example.com");
        assertThat(employee.status()).isEqualTo(MembershipStatus.ACTIVE);
        verify(audit).recordUserAction(eq(firmId), eq(admin.id()), any(), eq("platform.employee.provisioned"), eq("membership"),
                eq(employee.membershipId()), any());
    }

    @Test
    void employeeProvisioningCannotCreateAnotherOwner() {
        UUID firmId = UUID.randomUUID();
        when(firms.existsById(firmId)).thenReturn(true);

        assertThatThrownBy(() -> service().createEmployee(actor(), firmId,
                new CreatePlatformEmployeeRequest("Mira Miller", "mira@example.com", "secure temporary password", MembershipRole.OWNER)))
                .isInstanceOf(InvalidIdentityException.class);
        org.mockito.Mockito.verifyNoInteractions(users, memberships, passwords, audit);
    }

    private PlatformAdministrationService service() {
        return new PlatformAdministrationService(policy, firms, memberships, users, passwords, audit,
                Clock.fixed(now(), ZoneOffset.UTC));
    }

    private Authentication actor() { return new UsernamePasswordAuthenticationToken("admin@example.com", "n/a"); }
    private ForgeBoardUser user(String email) { return new ForgeBoardUser(UUID.randomUUID(), email, "Admin", "hash", now()); }
    private Instant now() { return Instant.parse("2026-07-23T12:00:00Z"); }
}
