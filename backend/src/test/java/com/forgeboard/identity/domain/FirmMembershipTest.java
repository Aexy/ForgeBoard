package com.forgeboard.identity.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class FirmMembershipTest {
    private static final Instant CREATED_AT = Instant.parse("2026-08-06T09:00:00Z");

    @Test
    void invitedMembershipCannotAuthorizeUntilActivationBindsAUser() {
        FirmMembership membership = FirmMembership.invited(UUID.randomUUID(), UUID.randomUUID(),
                MembershipRole.MEMBER, CREATED_AT);

        assertThat(membership.userId()).isNull();
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
}
