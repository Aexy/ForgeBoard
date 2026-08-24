package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class FirmAccessServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-07T10:00:00Z");

    @Mock UserRepository users;
    @Mock FirmMembershipRepository memberships;
    @Mock FirmRepository firms;

    @Test
    void freshSessionDiscoveryAdvertisesOnlyActiveMembershipsInActiveFirms() {
        ForgeBoardUser user = new ForgeBoardUser(UUID.randomUUID(), "member@example.com", "Member", "hash", NOW);
        Firm activeFirm = new Firm(UUID.randomUUID(), "Active Firm", "active-firm", NOW);
        Firm suspendedFirm = new Firm(UUID.randomUUID(), "Suspended Firm", "suspended-firm", NOW);
        suspendedFirm.suspend(NOW.plusSeconds(1));
        FirmMembership active = new FirmMembership(UUID.randomUUID(), activeFirm.id(), user.id(),
                MembershipRole.MEMBER, NOW);
        FirmMembership suspendedMembership = new FirmMembership(UUID.randomUUID(), activeFirm.id(), user.id(),
                MembershipRole.MANAGER, NOW);
        suspendedMembership.suspend(NOW.plusSeconds(1));
        FirmMembership activeInSuspendedFirm = new FirmMembership(UUID.randomUUID(), suspendedFirm.id(), user.id(),
                MembershipRole.OWNER, NOW);
        when(users.findByEmail(user.email())).thenReturn(Optional.of(user));
        when(memberships.findAllByUserId(user.id())).thenReturn(List.of(active, suspendedMembership, activeInSuspendedFirm));
        when(firms.findAllById(List.of(activeFirm.id(), suspendedFirm.id())))
                .thenReturn(List.of(activeFirm, suspendedFirm));

        assertThat(new FirmAccessService(users, memberships, firms).list(user.email()))
                .containsExactly(new FirmAccessView(activeFirm.id(), activeFirm.name(), activeFirm.slug(), active.role()));
    }
}
