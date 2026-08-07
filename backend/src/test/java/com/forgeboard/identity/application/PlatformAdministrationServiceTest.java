package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
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
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class PlatformAdministrationServiceTest {
    @Mock PlatformAdminPolicy policy;
    @Mock FirmRepository firms;
    @Mock FirmMembershipRepository memberships;
    @Mock UserRepository users;
    @Mock PasswordEncoder passwords;
    @Mock ActivityAuditService audit;

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
        verify(memberships).save(any(FirmMembership.class));
        verify(audit).recordUserAction(eq(firm.id()), eq(admin.id()), any(), eq("platform.firm.created"), eq("firm"),
                eq(firm.id()), any());
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

    private PlatformAdministrationService service() {
        return new PlatformAdministrationService(policy, firms, memberships, users, passwords, audit,
                Clock.fixed(now(), ZoneOffset.UTC));
    }

    private Authentication actor() { return new UsernamePasswordAuthenticationToken("admin@example.com", "n/a"); }
    private ForgeBoardUser user(String email) { return new ForgeBoardUser(UUID.randomUUID(), email, "Admin", "hash", now()); }
    private Instant now() { return Instant.parse("2026-07-23T12:00:00Z"); }
}
