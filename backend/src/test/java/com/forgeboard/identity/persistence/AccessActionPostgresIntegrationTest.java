package com.forgeboard.identity.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
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
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.application.AccessLifecycleService;
import com.forgeboard.identity.application.GeneratedAccessLink;
import com.forgeboard.identity.application.InviteMemberRequest;

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
    @Autowired PlatformTransactionManager transactions;
    @Autowired AccessLifecycleService lifecycle;

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
                """).param("id", UUID.randomUUID()).param("firmId", firmId)
                .param("createdAt", Timestamp.from(CREATED_AT)).update())
                .isInstanceOf(DataAccessException.class)
                .hasStackTraceContaining("firm_memberships_user_required_for_non_invited_check");

        assertThatThrownBy(() -> jdbc.sql("""
                insert into firm_memberships (id, firm_id, user_id, status, role, created_at, updated_at)
                values (:id, :firmId, null, 'SUSPENDED', 'MEMBER', :createdAt, :createdAt)
                """).param("id", UUID.randomUUID()).param("firmId", firmId)
                .param("createdAt", Timestamp.from(CREATED_AT)).update())
                .isInstanceOf(DataAccessException.class)
                .hasStackTraceContaining("firm_memberships_user_required_for_non_invited_check");

        assertThatThrownBy(() -> jdbc.sql("""
                insert into access_actions (id, action_type, target_email, token_hash, created_at, expires_at)
                values (:id, 'INVITATION', 'invitee@example.com', :tokenHash, :createdAt, :expiresAt)
                """).param("id", UUID.randomUUID()).param("tokenHash", "c".repeat(64))
                .param("createdAt", Timestamp.from(CREATED_AT))
                .param("expiresAt", Timestamp.from(CREATED_AT.plusSeconds(7 * 24 * 60 * 60))).update())
                .isInstanceOf(DataAccessException.class)
                .hasStackTraceContaining("access_actions_invitation_scope_check");

        assertThatThrownBy(() -> jdbc.sql("""
                insert into access_actions (id, firm_id, membership_id, action_type, target_email, token_hash, created_at, expires_at)
                values (:id, :firmId, :membershipId, 'INVITATION', 'invitee@example.com', 'raw-invitation-token',
                        :createdAt, :expiresAt)
                """).param("id", UUID.randomUUID()).param("firmId", firmId).param("membershipId", membership.id())
                .param("createdAt", Timestamp.from(CREATED_AT))
                .param("expiresAt", Timestamp.from(CREATED_AT.plusSeconds(7 * 24 * 60 * 60))).update())
                .isInstanceOf(DataAccessException.class)
                .hasStackTraceContaining("access_actions_token_hash_sha256_check");
    }

    @Test
    @Transactional
    void serializationLockTableAcceptsOnlyCanonicalKeysAndLocksTheInsertedRow() {
        String lockKey = "d".repeat(64);

        actions.createSerializationLock(lockKey);

        assertThat(actions.lockSerializationKey(lockKey)).isEqualTo(lockKey);
        assertThatThrownBy(() -> jdbc.sql("""
                insert into access_action_serialization_locks (lock_key, created_at)
                values ('not-a-sha256-digest', :createdAt)
                """).param("createdAt", Timestamp.from(CREATED_AT)).update())
                .isInstanceOf(DataAccessException.class)
                .hasStackTraceContaining("access_action_serialization_locks_key_sha256_check");
    }

    @Test
    void serializationLockBlocksASecondTransactionUntilTheFirstTransactionCompletes() throws Exception {
        String lockKey = "e".repeat(64);
        CountDownLatch firstLocked = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        CountDownLatch secondStarted = new CountDownLatch(1);
        CountDownLatch secondCompleted = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactions);
        try {
            Future<?> first = executor.submit(() -> transaction.executeWithoutResult(status -> {
                actions.createSerializationLock(lockKey);
                actions.lockSerializationKey(lockKey);
                firstLocked.countDown();
                await(releaseFirst);
            }));
            assertThat(firstLocked.await(5, TimeUnit.SECONDS)).isTrue();

            Future<?> second = executor.submit(() -> transaction.executeWithoutResult(status -> {
                secondStarted.countDown();
                actions.createSerializationLock(lockKey);
                actions.lockSerializationKey(lockKey);
                secondCompleted.countDown();
            }));
            assertThat(secondStarted.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(secondCompleted.await(250, TimeUnit.MILLISECONDS)).isFalse();

            releaseFirst.countDown();
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);
            assertThat(secondCompleted.getCount()).isZero();
        } finally {
            releaseFirst.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void revokeReinviteAndReissueReuseOnePendingMembershipAndLeaveOneLiveAction() {
        UUID firmId = UUID.randomUUID();
        firms.save(new Firm(firmId, "Sequence Firm", "sequence-firm", CREATED_AT));
        UUID actorId = creator();
        InviteMemberRequest request = new InviteMemberRequest("Invited Person", "invitee@example.com",
                MembershipRole.MEMBER);

        GeneratedAccessLink first = lifecycle.createInvitation(firmId, actorId, request);
        UUID membershipId = actions.findById(first.actionId()).orElseThrow().membershipId();
        lifecycle.revokeInvitation(firmId, actorId, membershipId);
        GeneratedAccessLink second = lifecycle.createInvitation(firmId, actorId, request);
        GeneratedAccessLink third = lifecycle.reissueInvitation(firmId, actorId, membershipId);

        assertThat(actions.findById(second.actionId()).orElseThrow().membershipId()).isEqualTo(membershipId);
        assertThat(actions.findById(third.actionId()).orElseThrow().membershipId()).isEqualTo(membershipId);
        assertThat(jdbc.sql("select count(*) from firm_memberships where firm_id = :firmId and status = 'INVITED'")
                .param("firmId", firmId).query(Long.class).single()).isEqualTo(1);
        assertThat(jdbc.sql("select count(*) from access_actions where firm_id = :firmId and action_type = 'INVITATION' "
                + "and consumed_at is null and revoked_at is null")
                .param("firmId", firmId).query(Long.class).single()).isEqualTo(1);
        FirmMembership pending = memberships.findById(membershipId).orElseThrow();
        assertThat(pending.invitationEmail()).isEqualTo("invitee@example.com");
        assertThat(pending.invitationDisplayName()).isEqualTo("Invited Person");
    }

    @Test
    void concurrentInvitationIssuanceKeepsOnePendingMembershipAndOneLiveAction() throws Exception {
        UUID firmId = UUID.randomUUID();
        firms.save(new Firm(firmId, "Concurrent Firm", "concurrent-firm", CREATED_AT));
        UUID actorId = creator();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = executor.submit(() -> {
                await(start);
                lifecycle.createInvitation(firmId, actorId,
                        new InviteMemberRequest("Concurrent Person", "concurrent@example.com", MembershipRole.MEMBER));
            });
            Future<?> second = executor.submit(() -> {
                await(start);
                lifecycle.createInvitation(firmId, actorId,
                        new InviteMemberRequest("Concurrent Person", "concurrent@example.com", MembershipRole.MANAGER));
            });
            start.countDown();
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);

            assertThat(jdbc.sql("select count(*) from firm_memberships where firm_id = :firmId and status = 'INVITED'")
                    .param("firmId", firmId).query(Long.class).single()).isEqualTo(1);
            assertThat(jdbc.sql("select count(*) from access_actions where firm_id = :firmId and action_type = 'INVITATION' "
                    + "and consumed_at is null and revoked_at is null")
                    .param("firmId", firmId).query(Long.class).single()).isEqualTo(1);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void removedExistingUserCanBeReinvitedThroughTheSameMembership() {
        UUID firmId = UUID.randomUUID();
        firms.save(new Firm(firmId, "Return Firm", "return-firm", CREATED_AT));
        ForgeBoardUser returning = users.save(new ForgeBoardUser(UUID.randomUUID(), "returning@example.com",
                "Returning Person", "hash", CREATED_AT));
        FirmMembership membership = memberships.save(new FirmMembership(UUID.randomUUID(), firmId, returning.id(),
                MembershipRole.MEMBER, CREATED_AT));
        membership.remove(CREATED_AT.plusSeconds(1));
        memberships.saveAndFlush(membership);
        UUID actorId = creator();

        GeneratedAccessLink invitation = lifecycle.createInvitation(firmId, actorId,
                new InviteMemberRequest("Returning Person", returning.email(), MembershipRole.MANAGER));
        FirmMembership pending = memberships.findById(membership.id()).orElseThrow();

        assertThat(actions.findById(invitation.actionId()).orElseThrow().membershipId()).isEqualTo(membership.id());
        assertThat(pending.status()).isEqualTo(MembershipStatus.INVITED);
        assertThat(pending.userId()).isEqualTo(returning.id());
    }

    @Test
    void databaseRejectsTwoLiveLinksForTheSameInvitationIdentity() {
        UUID firmId = UUID.randomUUID();
        FirmMembership membership = invitedMembership(firmId);
        UUID creatorId = creator();
        actions.saveAndFlush(new AccessAction(UUID.randomUUID(), firmId, membership.id(), null,
                AccessActionType.INVITATION, membership.invitationEmail(), new AccessAction.TokenHash("f".repeat(64)),
                creatorId, CREATED_AT));

        assertThatThrownBy(() -> actions.saveAndFlush(new AccessAction(UUID.randomUUID(), firmId, membership.id(), null,
                AccessActionType.INVITATION, membership.invitationEmail(), new AccessAction.TokenHash("0".repeat(64)),
                creatorId, CREATED_AT.plusSeconds(1))))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("Timed out waiting for lock release");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Interrupted while waiting for lock release", exception);
        }
    }

    private FirmMembership invitedMembership(UUID firmId) {
        firms.save(new Firm(firmId, "Pilot Firm " + firmId, "pilot-" + firmId.toString().substring(0, 8), CREATED_AT));
        return memberships.save(FirmMembership.invited(UUID.randomUUID(), firmId, "invitee-" + firmId + "@example.com",
                "Invitee", MembershipRole.MEMBER, CREATED_AT));
    }

    private UUID creator() {
        UUID userId = UUID.randomUUID();
        users.save(new ForgeBoardUser(userId, "creator-" + userId + "@example.com", "Creator", "hash", CREATED_AT));
        return userId;
    }
}
