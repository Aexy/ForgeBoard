package com.forgeboard.identity.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class FirmMembershipTest {
    private static final Instant CREATED_AT = Instant.parse("2026-08-06T09:00:00Z");

    @Test
    void invitedMembershipCannotAuthorizeUntilActivationBindsAUser() {
        FirmMembership membership = FirmMembership.invited(UUID.randomUUID(), UUID.randomUUID(),
                "invitee@example.com", "Invited Member", MembershipRole.MEMBER, CREATED_AT);

        assertThat(membership.userId()).isNull();
        assertThat(membership.invitationEmail()).isEqualTo("invitee@example.com");
        assertThat(membership.invitationDisplayName()).isEqualTo("Invited Member");
        assertThat(membership.status()).isEqualTo(MembershipStatus.INVITED);
        assertThat(membership.status()).isNotEqualTo(MembershipStatus.ACTIVE);

        UUID userId = UUID.randomUUID();
        membership.activate(userId, CREATED_AT.plusSeconds(60));

        assertThat(membership.userId()).isEqualTo(userId);
        assertThat(membership.status()).isEqualTo(MembershipStatus.ACTIVE);
    }

    @Test
    void removesABoundMembershipWithoutUnbindingItsUser() {
        UUID userId = UUID.randomUUID();
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), UUID.randomUUID(), userId,
                MembershipRole.MEMBER, CREATED_AT);

        membership.remove(CREATED_AT.plusSeconds(60));

        assertThat(membership.status()).isEqualTo(MembershipStatus.REMOVED);
        assertThat(membership.userId()).isEqualTo(userId);
    }

    @Test
    void removedMembershipIsTerminalForRoleAndStatusTransitions() {
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                MembershipRole.MEMBER, CREATED_AT);
        membership.remove(CREATED_AT.plusSeconds(60));

        assertThatThrownBy(() -> membership.changeRole(MembershipRole.ADMINISTRATOR, CREATED_AT.plusSeconds(61)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> membership.suspend(CREATED_AT.plusSeconds(61))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> membership.reactivate(CREATED_AT.plusSeconds(61))).isInstanceOf(IllegalStateException.class);
        assertThat(membership.status()).isEqualTo(MembershipStatus.REMOVED);
        assertThat(membership.role()).isEqualTo(MembershipRole.MEMBER);
    }

    @Test
    void removedMembershipCanOnlyReenterThroughAnExplicitInvitation() {
        UUID userId = UUID.randomUUID();
        FirmMembership membership = new FirmMembership(UUID.randomUUID(), UUID.randomUUID(), userId,
                MembershipRole.MEMBER, CREATED_AT);
        membership.remove(CREATED_AT.plusSeconds(60));

        membership.reinvite("member@example.com", "Member Again", MembershipRole.MANAGER,
                CREATED_AT.plusSeconds(120));

        assertThat(membership.userId()).isEqualTo(userId);
        assertThat(membership.status()).isEqualTo(MembershipStatus.INVITED);
        assertThat(membership.role()).isEqualTo(MembershipRole.MANAGER);
        assertThat(membership.invitationEmail()).isEqualTo("member@example.com");
        assertThat(membership.invitationDisplayName()).isEqualTo("Member Again");
    }
}
