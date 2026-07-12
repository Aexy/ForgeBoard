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
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class TenantAuthorizationServiceTest {
    @Mock UserRepository users;
    @Mock FirmMembershipRepository memberships;

    @Test
    void authorizesOnlyMembershipInTheSelectedFirm() {
        UUID userId = UUID.randomUUID();
        UUID firmId = UUID.randomUUID();
        ForgeBoardUser user = new ForgeBoardUser(userId, "owner@example.com", "Owner", "hash", Instant.now());
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), firmId, userId, MembershipRole.OWNER, Instant.now());
        when(users.findByEmail("owner@example.com")).thenReturn(Optional.of(user));
        when(memberships.findByFirmIdAndUserId(firmId, userId)).thenReturn(Optional.of(membership));

        SelectedTenant principal = new TenantAuthorizationService(users, memberships)
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

        assertThatThrownBy(() -> new TenantAuthorizationService(users, memberships)
                .authorize("member@example.com", firmId))
                .isInstanceOf(AccessDeniedException.class);
    }
}
