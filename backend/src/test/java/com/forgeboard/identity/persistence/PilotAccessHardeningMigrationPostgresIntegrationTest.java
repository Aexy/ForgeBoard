package com.forgeboard.identity.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class PilotAccessHardeningMigrationPostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @Test
    void migrationMergesLegacyPendingRowsIntoTheReturningUsersDurableMembership() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target("20").load().migrate();

        UUID firmId = UUID.randomUUID();
        UUID returningUserId = UUID.randomUUID();
        UUID durableMembershipId = UUID.randomUUID();
        UUID olderPendingId = UUID.randomUUID();
        UUID newerPendingId = UUID.randomUUID();
        UUID orphanPendingId = UUID.randomUUID();
        UUID acceptedUserId = UUID.randomUUID();
        UUID acceptedMembershipId = UUID.randomUUID();
        UUID consumedActionId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.parse("2026-08-06T09:00:00Z");
        try (Connection connection = connection()) {
            insert(connection, "insert into firms (id, name, slug, created_at, updated_at) values (?, ?, ?, ?, ?)",
                    firmId, "Migration Firm", "migration-firm", now, now);
            insert(connection, "insert into users (id, email, display_name, password_hash, created_at, updated_at) "
                    + "values (?, ?, ?, ?, ?, ?)", returningUserId, " returning@example.com ", "Returning Person",
                    "hash", now, now);
            insert(connection, "insert into users (id, email, display_name, password_hash, created_at, updated_at) "
                    + "values (?, ?, ?, ?, ?, ?)", acceptedUserId, "accepted@example.com", "Accepted Person",
                    "hash", now, now);
            insert(connection, "insert into firm_memberships "
                    + "(id, firm_id, user_id, status, role, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
                    durableMembershipId, firmId, returningUserId, "REMOVED", "MEMBER", now, now);
            insert(connection, "insert into firm_memberships "
                    + "(id, firm_id, user_id, status, role, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
                    acceptedMembershipId, firmId, acceptedUserId, "ACTIVE", "MEMBER", now, now);
            insert(connection, "insert into firm_memberships "
                    + "(id, firm_id, user_id, status, role, created_at, updated_at) values (?, ?, null, ?, ?, ?, ?)",
                    olderPendingId, firmId, "INVITED", "MEMBER", now.plusMinutes(1), now.plusMinutes(1));
            insert(connection, "insert into firm_memberships "
                    + "(id, firm_id, user_id, status, role, created_at, updated_at) values (?, ?, null, ?, ?, ?, ?)",
                    newerPendingId, firmId, "INVITED", "MANAGER", now.plusMinutes(2), now.plusMinutes(2));
            insert(connection, "insert into firm_memberships "
                    + "(id, firm_id, user_id, status, role, created_at, updated_at) values (?, ?, null, ?, ?, ?, ?)",
                    orphanPendingId, firmId, "INVITED", "MEMBER", now.plusMinutes(3), now.plusMinutes(3));
            insertAction(connection, firmId, olderPendingId, returningUserId, " RETURNING@EXAMPLE.COM ",
                    "a".repeat(64), now.plusMinutes(1));
            insertAction(connection, firmId, newerPendingId, returningUserId, "returning@example.com",
                    "b".repeat(64), now.plusMinutes(2));
            insert(connection, "insert into access_actions (id, firm_id, membership_id, action_type, target_email, "
                    + "token_hash, created_by_user_id, created_at, expires_at, consumed_at) "
                    + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", consumedActionId, firmId, acceptedMembershipId,
                    "INVITATION", "accepted@example.com", "c".repeat(64), returningUserId, now,
                    now.plusDays(7), now.plusMinutes(1));
        }

        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").load().migrate();

        try (Connection connection = connection()) {
            assertThat(longValue(connection, "select count(*) from firm_memberships where firm_id = ?", firmId))
                    .isEqualTo(2);
            assertThat(longValue(connection, "select count(*) from firm_memberships where id = ?", orphanPendingId))
                    .isZero();
            assertThat(stringValue(connection, "select status from firm_memberships where id = ?", durableMembershipId))
                    .isEqualTo("INVITED");
            assertThat(stringValue(connection, "select role from firm_memberships where id = ?", durableMembershipId))
                    .isEqualTo("MANAGER");
            assertThat(stringValue(connection, "select invitation_email from firm_memberships where id = ?",
                    durableMembershipId)).isEqualTo("returning@example.com");
            assertThat(longValue(connection, "select count(*) from access_actions where membership_id = ?",
                    durableMembershipId)).isEqualTo(2);
            assertThat(longValue(connection, "select count(*) from access_actions where membership_id = ? "
                    + "and revoked_at is null and consumed_at is null", durableMembershipId)).isEqualTo(1);
            assertThat(stringValue(connection, "select token_hash from access_actions where membership_id = ? "
                    + "and revoked_at is null and consumed_at is null", durableMembershipId)).isEqualTo("b".repeat(64));
            assertThat(longValue(connection, "select count(*) from access_actions "
                    + "where target_email <> lower(btrim(target_email))")).isZero();
            assertThat(stringValue(connection, "select user_id::text from access_actions where id = ?",
                    consumedActionId)).isEqualTo(acceptedUserId.toString());
        }
    }

    private void insertAction(Connection connection, UUID firmId, UUID membershipId, UUID creatorId,
            String targetEmail, String tokenHash, OffsetDateTime createdAt) throws Exception {
        insert(connection, "insert into access_actions (id, firm_id, membership_id, action_type, target_email, "
                + "token_hash, created_by_user_id, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                UUID.randomUUID(), firmId, membershipId, "INVITATION", targetEmail, tokenHash, creatorId,
                createdAt, createdAt.plusDays(7));
    }

    private Connection connection() throws Exception {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void insert(Connection connection, String sql, Object... values) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) statement.setObject(index + 1, values[index]);
            statement.executeUpdate();
        }
    }

    private String stringValue(Connection connection, String sql, Object... values) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) statement.setObject(index + 1, values[index]);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getString(1);
            }
        }
    }

    private long longValue(Connection connection, String sql, Object... values) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) statement.setObject(index + 1, values[index]);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getLong(1);
            }
        }
    }
}
