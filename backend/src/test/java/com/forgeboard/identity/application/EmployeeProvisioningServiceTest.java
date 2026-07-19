package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.EmployeeDirectory;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class EmployeeProvisioningServiceTest {
    @Mock TenantAuthorizationService policy; @Mock UserRepository users; @Mock FirmMembershipRepository memberships;
    @Mock PasswordEncoder passwords; @Mock ActivityRecorder activity;
    @Mock EmployeeDirectory employees;

    @Test
    void ownerCreatesEmployeeMembershipAndAuditEvent() {
        SelectedTenant tenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "owner@example.com", MembershipRole.OWNER);
        when(users.findByEmail("mira@example.com")).thenReturn(Optional.empty()); when(passwords.encode(any())).thenReturn("hash");
        when(users.save(any())).thenAnswer(call -> call.getArgument(0)); when(memberships.save(any())).thenAnswer(call -> call.getArgument(0));
        EmployeeProvisioningService service = service();
        EmployeeView employee = service.create(tenant, new CreateEmployeeRequest("Mira Miller", "MIRA@example.com", "secure temporary password", MembershipRole.MEMBER));
        assertThat(employee.email()).isEqualTo("mira@example.com");
        verify(activity).recordRestUserAction(org.mockito.ArgumentMatchers.eq(tenant.firmId()), org.mockito.ArgumentMatchers.eq(tenant.userId()),
                org.mockito.ArgumentMatchers.eq("employee.created"), org.mockito.ArgumentMatchers.eq("membership"),
                org.mockito.ArgumentMatchers.eq(employee.membershipId()), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void memberCannotCreateEmployee() {
        SelectedTenant tenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "member@example.com", MembershipRole.MEMBER);
        org.mockito.Mockito.doThrow(new AccessDeniedException("denied")).when(policy).requireMembershipManagement(tenant);
        assertThatThrownBy(() -> service().create(tenant, new CreateEmployeeRequest("Mira", "mira@example.com", "secure temporary password", MembershipRole.MEMBER))).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void rejectsAnExistingAccountInsteadOfIgnoringItsTemporaryPassword() {
        SelectedTenant tenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "owner@example.com", MembershipRole.OWNER);
        ForgeBoardUser existing = new ForgeBoardUser(UUID.randomUUID(), "mira@example.com", "Mira", "existing-hash", Instant.now());
        when(users.findByEmail("mira@example.com")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service().create(tenant,
                new CreateEmployeeRequest("Mira Miller", "mira@example.com", "new temporary password", MembershipRole.MEMBER)))
                .isInstanceOf(DuplicateIdentityException.class);
        verify(memberships, org.mockito.Mockito.never()).save(any());
        verify(passwords, org.mockito.Mockito.never()).encode(any());
    }

    @Test
    void listsEmployeesThroughTheFirmScopedDirectoryAfterAuthorizingTheActor() {
        SelectedTenant tenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "owner@example.com", MembershipRole.OWNER);
        var expected = java.util.List.of(new EmployeeView(UUID.randomUUID(), UUID.randomUUID(), "Mira Miller", "mira@example.com", MembershipRole.MEMBER));
        when(employees.list(tenant.firmId())).thenReturn(expected);

        assertThat(service().list(tenant)).isEqualTo(expected);

        var order = org.mockito.Mockito.inOrder(policy, employees);
        order.verify(policy).requireMembershipManagement(tenant);
        order.verify(employees).list(tenant.firmId());
    }

    private EmployeeProvisioningService service() { return new EmployeeProvisioningService(policy, users, memberships, employees, passwords, activity, Clock.fixed(Instant.parse("2026-07-14T00:00:00Z"), ZoneOffset.UTC)); }
}
