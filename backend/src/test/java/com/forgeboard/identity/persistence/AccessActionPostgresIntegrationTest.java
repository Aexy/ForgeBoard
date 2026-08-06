package com.forgeboard.identity.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.forgeboard.identity.domain.AccessAction;
import com.forgeboard.identity.domain.AccessActionType;
import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class AccessActionPostgresIntegrationTest {
    private static final Instant CREATED_AT = Instant.parse("2026-08-06T09:00:00Z");

    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired AccessActionRepository actions;
    @Autowired FirmRepository firms;
    @Autowired FirmMembershipRepository memberships;
    @Autowired UserRepository users;
    @Autowired JdbcClient jdbc;

    @Test
    @Transactional
    void actionIsRedeemableOnlyBeforeItsSevenDayExpiryAndBeforeConsumptionOrRevocation() {
        UUID firmId = UUID.randomUUID();
        FirmMembership membership = invitedMembership(firmId);
        UUID creatorId = creator();
        AccessAction action = actions.save(new AccessAction(UUID.randomUUID(), firmId, membership.id(), null,
                AccessActionType.INVITATION, "invitee@example.com", new AccessAction.TokenHash("a".repeat(64)),
                creatorId, CREATED_AT));

        assertThat(memberships.findByIdAndFirmId(membership.id(), firmId)).containsSame(membership);
        assertThat(action.expiresAt()).isEqualTo(CREATED_AT.plusSeconds(7 * 24 * 60 * 60));
        assertThat(action.isRedeemable(CREATED_AT.plusSeconds(7 * 24 * 60 * 60 - 1))).isTrue();
        assertThat(action.isRedeemable(CREATED_AT.plusSeconds(7 * 24 * 60 * 60))).isFalse();

        assertThat(actions.findByTokenHashForUpdate("a".repeat(64))).containsSame(action);
        action.consume(CREATED_AT.plusSeconds(60));

        assertThat(action.isRedeemable(CREATED_AT.plusSeconds(61))).isFalse();
        assertThatThrownBy(() -> action.consume(CREATED_AT.plusSeconds(62)))
                .isInstanceOf(IllegalStateException.class);

        AccessAction revokedAction = actions.save(new AccessAction(UUID.randomUUID(), firmId, membership.id(), null,
                AccessActionType.INVITATION, "revoked@example.com", new AccessAction.TokenHash("b".repeat(64)),
                creatorId, CREATED_AT));
        revokedAction.revoke(CREATED_AT.plusSeconds(60));

        assertThat(revokedAction.isRedeemable(CREATED_AT.plusSeconds(61))).isFalse();
    }

    @Test
    void flywayAllowsOnlyInvitedMembershipsWithoutUsersAndRequiresInvitationScope() {
        UUID firmId = UUID.randomUUID();
        FirmMembership membership = invitedMembership(firmId);

        assertThatThrownBy(() -> jdbc.sql("""
                insert into firm_memberships (id, firm_id, user_id, status, role, created_at, updated_at)
                values (:id, :firmId, null, 'ACTIVE', 'MEMBER', :createdAt, :createdAt)
                """).param("id", UUID.randomUUID()).param("firmId", firmId).param("createdAt", CREATED_AT).update())
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbc.sql("""
                insert into firm_memberships (id, firm_id, user_id, status, role, created_at, updated_at)
                values (:id, :firmId, null, 'SUSPENDED', 'MEMBER', :createdAt, :createdAt)
                """).param("id", UUID.randomUUID()).param("firmId", firmId).param("createdAt", CREATED_AT).update())
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbc.sql("""
                insert into access_actions (id, action_type, target_email, token_hash, created_at, expires_at)
                values (:id, 'INVITATION', 'invitee@example.com', :tokenHash, :createdAt, :expiresAt)
                """).param("id", UUID.randomUUID()).param("tokenHash", "c".repeat(64))
                .param("createdAt", CREATED_AT).param("expiresAt", CREATED_AT.plusSeconds(7 * 24 * 60 * 60)).update())
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbc.sql("""
                insert into access_actions (id, firm_id, membership_id, action_type, target_email, token_hash, created_at, expires_at)
                values (:id, :firmId, :membershipId, 'INVITATION', 'invitee@example.com', 'raw-invitation-token',
                        :createdAt, :expiresAt)
                """).param("id", UUID.randomUUID()).param("firmId", firmId).param("membershipId", membership.id())
                .param("createdAt", CREATED_AT).param("expiresAt", CREATED_AT.plusSeconds(7 * 24 * 60 * 60)).update())
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private FirmMembership invitedMembership(UUID firmId) {
        firms.save(new Firm(firmId, "Pilot Firm " + firmId, "pilot-" + firmId.toString().substring(0, 8), CREATED_AT));
        return memberships.save(FirmMembership.invited(UUID.randomUUID(), firmId, MembershipRole.MEMBER, CREATED_AT));
    }

    private UUID creator() {
        UUID userId = UUID.randomUUID();
        users.save(new ForgeBoardUser(userId, "creator-" + userId + "@example.com", "Creator", "hash", CREATED_AT));
        return userId;
    }
}
