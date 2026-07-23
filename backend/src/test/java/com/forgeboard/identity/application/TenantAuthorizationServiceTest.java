package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class TenantAuthorizationServiceTest {
    @Mock UserRepository users;
    @Mock FirmMembershipRepository memberships;
    @Mock FirmRepository firms;

    @Test
    void authorizesOnlyMembershipInTheSelectedFirm() {
        UUID userId = UUID.randomUUID();
        UUID firmId = UUID.randomUUID();
        ForgeBoardUser user = new ForgeBoardUser(userId, "owner@example.com", "Owner", "hash", Instant.now());
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), firmId, userId, MembershipRole.OWNER, Instant.now());
        Firm firm = new Firm(firmId, "Owner Firm", "owner-firm", Instant.now());
        when(users.findByEmail("owner@example.com")).thenReturn(Optional.of(user));
        when(memberships.findByFirmIdAndUserId(firmId, userId)).thenReturn(Optional.of(membership));
        when(firms.findById(firmId)).thenReturn(Optional.of(firm));

        SelectedTenant principal = new TenantAuthorizationService(users, memberships, firms)
                .authorize("OWNER@EXAMPLE.COM", firmId);
        assertThat(principal.firmId()).isEqualTo(firmId);
        assertThat(principal.role()).isEqualTo(MembershipRole.OWNER);
    }

    @Test
    void rejectsAUserOutsideTheSelectedFirm() {
        UUID userId = UUID.randomUUID();
        UUID firmId = UUID.randomUUID();
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(
                new ForgeBoardUser(userId, "member@example.com", "Member", "hash", Instant.now())));
        when(memberships.findByFirmIdAndUserId(firmId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> new TenantAuthorizationService(users, memberships, firms)
                .authorize("member@example.com", firmId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void rejectsAnActiveMembershipWhenItsFirmIsSuspendedAndAllowsAccessAfterReactivation() {
        UUID userId = UUID.randomUUID();
        UUID firmId = UUID.randomUUID();
        Instant now = Instant.parse("2026-07-23T09:00:00Z");
        ForgeBoardUser user = new ForgeBoardUser(userId, "member@example.com", "Member", "hash", now);
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), firmId, userId, MembershipRole.MEMBER, now);
        Firm firm = new Firm(firmId, "Member Firm", "member-firm", now);
        firm.suspend(now.plusSeconds(1));
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(user));
        when(memberships.findByFirmIdAndUserId(firmId, userId)).thenReturn(Optional.of(membership));
        when(firms.findById(firmId)).thenReturn(Optional.of(firm));

        TenantAuthorizationService authorization = new TenantAuthorizationService(users, memberships, firms);

        assertThatThrownBy(() -> authorization.authorize(user.email(), firmId))
                .isInstanceOf(AccessDeniedException.class);

        firm.reactivate(now.plusSeconds(2));

        assertThat(authorization.authorize(user.email(), firmId).firmId()).isEqualTo(firmId);
    }

    @Test
    void rejectsASuspendedMembershipAndAllowsAccessAfterReactivation() {
        UUID userId = UUID.randomUUID();
        UUID firmId = UUID.randomUUID();
        Instant now = Instant.parse("2026-07-23T09:00:00Z");
        ForgeBoardUser user = new ForgeBoardUser(userId, "member@example.com", "Member", "hash", now);
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), firmId, userId, MembershipRole.MEMBER, now);
        membership.suspend(now.plusSeconds(1));
        Firm firm = new Firm(firmId, "Member Firm", "member-firm", now);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(user));
        when(memberships.findByFirmIdAndUserId(firmId, userId)).thenReturn(Optional.of(membership));
        when(firms.findById(firmId)).thenReturn(Optional.of(firm));

        TenantAuthorizationService authorization = new TenantAuthorizationService(users, memberships, firms);

        assertThatThrownBy(() -> authorization.authorize(user.email(), firmId))
                .isInstanceOf(AccessDeniedException.class);

        membership.reactivate(now.plusSeconds(2));

        assertThat(authorization.authorize(user.email(), firmId).firmId()).isEqualTo(firmId);
    }
}
