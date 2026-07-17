package com.forgeboard.work.persistence;

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
class WorkflowPublicIdentifierMigrationPostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @Test
    void backfillsDeterministicFirmScopedPublicIdentifiersForPopulatedData() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target("14").load().migrate();

        UUID firmId = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();
        UUID firstWorkflowId = UUID.randomUUID();
        UUID secondWorkflowId = UUID.randomUUID();
        UUID thirdWorkflowId = UUID.randomUUID();
        UUID firstStageId = UUID.randomUUID();
        UUID secondStageId = UUID.randomUUID();
        UUID thirdStageId = UUID.randomUUID();
        UUID firstItemId = UUID.randomUUID();
        UUID secondItemId = UUID.randomUUID();
        UUID thirdItemId = UUID.randomUUID();
        OffsetDateTime firstCreated = OffsetDateTime.parse("2026-07-01T08:00:00Z");
        OffsetDateTime secondCreated = OffsetDateTime.parse("2026-07-01T09:00:00Z");
        OffsetDateTime thirdCreated = OffsetDateTime.parse("2026-07-01T10:00:00Z");

        try (Connection connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            insert(connection, "insert into firms (id, name, slug, created_at, updated_at) values (?, ?, ?, ?, ?)",
                    firmId, "Firm", "firm", firstCreated, firstCreated);
            insert(connection, "insert into clients (id, firm_id, legal_name, display_name, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
                    clientId, firmId, "Client", "Client", firstCreated, firstCreated);
            insert(connection, "insert into workflows (id, firm_id, name, created_at, updated_at) values (?, ?, ?, ?, ?)",
                    firstWorkflowId, firmId, "Monthly bookkeeping", firstCreated, firstCreated);
            insert(connection, "insert into workflows (id, firm_id, name, created_at, updated_at) values (?, ?, ?, ?, ?)",
                    secondWorkflowId, firmId, "Monthly-bookkeeping", secondCreated, secondCreated);
            insert(connection, "insert into workflows (id, firm_id, name, created_at, updated_at) values (?, ?, ?, ?, ?)",
                    thirdWorkflowId, firmId, "Monthly-bookkeeping-2", thirdCreated, thirdCreated);
            insert(connection, "insert into workflow_stages (id, firm_id, workflow_id, name, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
                    firstStageId, firmId, firstWorkflowId, "Preparation", 0, firstCreated, firstCreated);
            insert(connection, "insert into workflow_stages (id, firm_id, workflow_id, name, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
                    secondStageId, firmId, secondWorkflowId, "Preparation", 0, secondCreated, secondCreated);
            insert(connection, "insert into workflow_stages (id, firm_id, workflow_id, name, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
                    thirdStageId, firmId, thirdWorkflowId, "Preparation", 0, thirdCreated, thirdCreated);
            insertWorkItem(connection, firstItemId, firmId, clientId, firstWorkflowId, firstStageId, firstCreated);
            insertWorkItem(connection, secondItemId, firmId, clientId, secondWorkflowId, secondStageId, secondCreated);
            insertWorkItem(connection, thirdItemId, firmId, clientId, thirdWorkflowId, thirdStageId, thirdCreated);
        }

        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").load().migrate();

        try (Connection connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            assertThat(stringValue(connection, "select workflow_slug from workflows where id = ?", firstWorkflowId))
                    .isEqualTo("monthly-bookkeeping");
            assertThat(stringValue(connection, "select workflow_slug from workflows where id = ?", secondWorkflowId))
                    .isEqualTo("monthly-bookkeeping-2");
            assertThat(stringValue(connection, "select workflow_slug from workflows where id = ?", thirdWorkflowId))
                    .isEqualTo("monthly-bookkeeping-2-2");
            assertThat(stringValue(connection, "select task_reference from work_items where id = ?", firstItemId)).isEqualTo("FB-1");
            assertThat(stringValue(connection, "select task_reference from work_items where id = ?", secondItemId)).isEqualTo("FB-2");
            assertThat(stringValue(connection, "select task_reference from work_items where id = ?", thirdItemId)).isEqualTo("FB-3");
            assertThat(stringValue(connection, "select 'FB-' || nextval('work_item_task_reference_sequence')")).isEqualTo("FB-4");
        }
    }

    private void insertWorkItem(Connection connection, UUID itemId, UUID firmId, UUID clientId, UUID workflowId,
            UUID stageId, OffsetDateTime createdAt) throws Exception {
        insert(connection, "insert into work_items (id, firm_id, client_id, workflow_id, stage_id, title, description, priority, rank, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                itemId, firmId, clientId, workflowId, stageId, "Task", "", "NORMAL", java.math.BigDecimal.ONE, createdAt, createdAt);
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
