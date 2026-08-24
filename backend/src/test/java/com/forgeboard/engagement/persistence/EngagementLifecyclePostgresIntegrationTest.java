package com.forgeboard.engagement.persistence;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class EngagementLifecyclePostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    private final UUID firmId = UUID.randomUUID();
    private final UUID otherFirmId = UUID.randomUUID();
    private final UUID clientId = UUID.randomUUID();
    private final UUID workflowId = UUID.randomUUID();
    private final UUID stageId = UUID.randomUUID();
    private final UUID workItemId = UUID.randomUUID();
    private final UUID unrelatedWorkItemId = UUID.randomUUID();
    private final UUID templateId = UUID.randomUUID();
    private final UUID engagementId = UUID.randomUUID();
    private final OffsetDateTime now = OffsetDateTime.parse("2026-07-24T08:00:00Z");

    @BeforeEach
    void migrateAndSeed() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").cleanDisabled(false).load().clean();
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").load().migrate();
        try (Connection connection = connection()) {
            insert(connection, "insert into firms (id, name, slug, created_at, updated_at) values (?, ?, ?, ?, ?)",
                    firmId, "Firm", "firm-" + firmId, now, now);
            insert(connection, "insert into firms (id, name, slug, created_at, updated_at) values (?, ?, ?, ?, ?)",
                    otherFirmId, "Other", "other-" + otherFirmId, now, now);
            insert(connection, "insert into clients (id, firm_id, legal_name, display_name, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
                    clientId, firmId, "Client", "Client", now, now);
            insert(connection, "insert into workflows (id, firm_id, name, workflow_slug, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
                    workflowId, firmId, "Workflow", "workflow-" + workflowId, now, now);
            insert(connection, "insert into workflow_stages (id, firm_id, workflow_id, name, position, attention_status, is_final, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    stageId, firmId, workflowId, "Preparation", 0, "NONE", true, now, now);
            insert(connection, "insert into work_items (id, firm_id, client_id, workflow_id, stage_id, title, description, priority, rank, task_reference, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    workItemId, firmId, clientId, workflowId, stageId, "Task", "", "NORMAL", BigDecimal.ONE,
                    "FB-" + workItemId.toString().substring(0, 8), now, now);
            insert(connection, "insert into work_items (id, firm_id, client_id, workflow_id, stage_id, title, description, priority, rank, task_reference, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    unrelatedWorkItemId, firmId, clientId, workflowId, stageId, "Unrelated task", "", "NORMAL", BigDecimal.TEN,
                    "FB-" + unrelatedWorkItemId.toString().substring(0, 8), now, now);
            insert(connection, "insert into engagement_templates (id, firm_id, workflow_id, name, recurrence, default_work_item_title, due_day, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    templateId, firmId, workflowId, "Template", "MONTHLY", "Task", 20, now, now);
            insertEngagement(connection, engagementId, firmId, workItemId, "ACTIVE", null);
        }
    }

    @Test
    void admitsValidLifecycleHistoryAndRejectsInvalidPersistedStates() throws Exception {
        try (Connection connection = connection()) {
            insert(connection, "insert into engagement_review_decisions (id, firm_id, engagement_id, work_item_id, actor_id, decision, note, occurred_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), firmId, engagementId, workItemId, UUID.randomUUID(), "RETURNED", "Please reconcile this", now);
            insert(connection, "insert into engagement_review_decisions (id, firm_id, engagement_id, work_item_id, actor_id, decision, note, occurred_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), firmId, engagementId, workItemId, UUID.randomUUID(), "APPROVED", null, now);

            assertThatThrownBy(() -> insertEngagement(connection, UUID.randomUUID(), firmId, null, "OPEN", null))
                    .isInstanceOf(Exception.class);
            assertThatThrownBy(() -> insertEngagement(connection, UUID.randomUUID(), firmId, null, "ARCHIVED", "ACTIVE"))
                    .isInstanceOf(Exception.class);
            assertThatThrownBy(() -> insertEngagement(connection, UUID.randomUUID(), firmId, null, "ARCHIVED", null))
                    .isInstanceOf(Exception.class);
            assertThatThrownBy(() -> insert(connection, "insert into engagement_review_decisions (id, firm_id, engagement_id, work_item_id, actor_id, decision, note, occurred_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), firmId, engagementId, workItemId, UUID.randomUUID(), "RETURNED", "   ", now))
                    .isInstanceOf(Exception.class);
            assertThatThrownBy(() -> insert(connection, "insert into engagement_review_decisions (id, firm_id, engagement_id, work_item_id, actor_id, decision, note, occurred_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), firmId, engagementId, workItemId, UUID.randomUUID(), "RETURNED", null, now))
                    .isInstanceOf(Exception.class);
            assertThatThrownBy(() -> insert(connection, "insert into engagement_review_decisions (id, firm_id, engagement_id, work_item_id, actor_id, decision, note, occurred_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), firmId, engagementId, workItemId, UUID.randomUUID(), "APPROVED", "not allowed", now))
                    .isInstanceOf(Exception.class);
            assertThatThrownBy(() -> insert(connection, "insert into workflow_stages (id, firm_id, workflow_id, name, position, attention_status, is_final, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), firmId, workflowId, "Second final", 1, "NONE", true, now, now))
                    .isInstanceOf(Exception.class);
            assertThatThrownBy(() -> insert(connection, "insert into engagement_review_decisions (id, firm_id, engagement_id, work_item_id, actor_id, decision, note, occurred_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), otherFirmId, engagementId, workItemId, UUID.randomUUID(), "APPROVED", null, now))
                    .isInstanceOf(Exception.class);
            assertThatThrownBy(() -> insert(connection, "insert into engagement_review_decisions (id, firm_id, engagement_id, work_item_id, actor_id, decision, note, occurred_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), firmId, engagementId, unrelatedWorkItemId, UUID.randomUUID(), "APPROVED", null, now))
                    .isInstanceOf(Exception.class);
        }
    }

    private Connection connection() throws Exception {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void insertEngagement(Connection connection, UUID id, UUID tenant, UUID item, String status, String archivedFrom) throws Exception {
        insert(connection, "insert into engagements (id, firm_id, template_id, client_id, workflow_id, work_item_id, period_start, period_end, due_date, status, status_changed_at, archived_from_status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id, tenant, templateId, clientId, workflowId, item, java.sql.Date.valueOf("2026-07-01"), java.sql.Date.valueOf("2026-07-31"),
                java.sql.Date.valueOf("2026-08-20"), status, now, archivedFrom, now, now);
    }

    private void insert(Connection connection, String sql, Object... values) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) statement.setObject(index + 1, values[index]);
            statement.executeUpdate();
        }
    }
}
