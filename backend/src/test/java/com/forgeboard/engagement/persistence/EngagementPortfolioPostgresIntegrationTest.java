package com.forgeboard.engagement.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import com.forgeboard.engagement.application.EngagementPortfolioQuery;
import com.forgeboard.engagement.application.EngagementPortfolioRow;
import com.forgeboard.engagement.domain.EngagementStatus;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class EngagementPortfolioPostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired EngagementPortfolioRepository portfolio;
    @Autowired JdbcTemplate jdbc;

    @Test
    @Transactional
    void bindsNullableSearchAsTextAndKeepsPaginationTenantScoped() {
        UUID firmId = insertFirm("Alpine firm");
        UUID otherFirmId = insertFirm("Other firm");
        UUID alpineId = insertEngagement(firmId, "Alpine GmbH", "Monthly VAT");
        insertEngagement(firmId, "Beta KG", "Annual Returns");
        insertEngagement(otherFirmId, "Alpine Foreign", "Monthly VAT");

        assertThat(find(firmId, null, 0, 25).getContent()).hasSize(2);
        assertThat(find(firmId, normalizedQuery(""), 0, 25).getContent()).hasSize(2);
        assertThat(find(firmId, normalizedQuery("   "), 0, 25).getContent()).hasSize(2);
        assertThat(find(firmId, "aLpInE", 0, 25).getContent()).extracting(EngagementPortfolioRow::id)
                .containsExactly(alpineId);
        assertThat(find(firmId, "returns", 0, 25).getContent()).hasSize(1);
        assertThat(find(firmId, "missing", 0, 25).getContent()).isEmpty();

        Page<EngagementPortfolioRow> firstPage = find(firmId, null, 0, 1);
        assertThat(firstPage.getContent()).hasSize(1);
        assertThat(firstPage.getTotalElements()).isEqualTo(2);
        assertThat(firstPage.getTotalPages()).isEqualTo(2);
        assertThat(find(otherFirmId, null, 0, 25).getContent()).hasSize(1);
    }

    private String normalizedQuery(String value) {
        return new EngagementPortfolioQuery(value, null, null, null, null, null, null, Set.of(), Set.of(), 0, 25).query();
    }

    private Page<EngagementPortfolioRow> find(UUID firmId, String query, int page, int pageSize) {
        return portfolio.findPortfolio(firmId, query, null, null, null, null, null, null, true,
                List.of(EngagementStatus.ACTIVE), true, false, false, false, false, false,
                LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 12), PageRequest.of(page, pageSize));
    }

    private UUID insertFirm(String name) {
        UUID id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.parse("2026-10-05T00:00:00Z");
        jdbc.update("insert into firms (id, name, slug, created_at, updated_at) values (?, ?, ?, ?, ?)",
                id, name, "firm-" + id, now, now);
        return id;
    }

    private UUID insertEngagement(UUID firmId, String clientName, String templateName) {
        UUID clientId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID stageId = UUID.randomUUID();
        UUID workItemId = UUID.randomUUID();
        UUID templateId = UUID.randomUUID();
        UUID engagementId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.parse("2026-10-05T00:00:00Z");
        jdbc.update("insert into clients (id, firm_id, legal_name, display_name, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
                clientId, firmId, clientName + " Legal", clientName, now, now);
        jdbc.update("insert into workflows (id, firm_id, name, workflow_slug, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
                workflowId, firmId, templateName, "workflow-" + workflowId, now, now);
        jdbc.update("insert into workflow_stages (id, firm_id, workflow_id, name, position, attention_status, is_final, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                stageId, firmId, workflowId, "Preparation", 0, "NONE", true, now, now);
        jdbc.update("insert into work_items (id, firm_id, client_id, workflow_id, stage_id, title, description, priority, rank, task_reference, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                workItemId, firmId, clientId, workflowId, stageId, templateName, "", "NORMAL", BigDecimal.ONE,
                "FB-" + workItemId.toString().substring(0, 8), now, now);
        jdbc.update("insert into engagement_templates (id, firm_id, workflow_id, name, recurrence, default_work_item_title, due_day, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                templateId, firmId, workflowId, templateName, "MONTHLY", templateName, 20, now, now);
        jdbc.update("insert into engagement_template_versions (id, firm_id, template_id, definition_version, workflow_id, name, recurrence, default_work_item_title, due_day, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                UUID.randomUUID(), firmId, templateId, 1, workflowId, templateName, "MONTHLY", templateName, 20,
                UUID.randomUUID(), now);
        jdbc.update("insert into engagements (id, firm_id, template_id, template_version, client_id, workflow_id, work_item_id, period_start, period_end, due_date, status, status_changed_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                engagementId, firmId, templateId, 1, clientId, workflowId, workItemId, LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 30), LocalDate.of(2026, 10, 20), "ACTIVE", now, now, now);
        return engagementId;
    }
}
