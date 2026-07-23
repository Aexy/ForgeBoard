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
class FirmLifecyclePostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @Test
    void migratesExistingFirmsAndMembershipsToActiveStatus() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target("15").load().migrate();

        UUID firmId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.parse("2026-07-23T09:00:00Z");
        try (Connection connection = connection()) {
            insert(connection, "insert into firms (id, name, slug, created_at, updated_at) values (?, ?, ?, ?, ?)",
                    firmId, "Lifecycle Firm", "lifecycle-firm", now, now);
            insert(connection, "insert into users (id, email, display_name, password_hash, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
                    userId, "owner@example.com", "Owner", "hash", now, now);
            insert(connection, "insert into firm_memberships (id, firm_id, user_id, role, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
                    membershipId, firmId, userId, "OWNER", now, now);
        }

        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").load().migrate();

        try (Connection connection = connection()) {
            assertThat(stringValue(connection, "select status from firms where id = ?", firmId)).isEqualTo("ACTIVE");
            assertThat(stringValue(connection, "select status from firm_memberships where id = ?", membershipId))
                    .isEqualTo("ACTIVE");
        }
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
}
