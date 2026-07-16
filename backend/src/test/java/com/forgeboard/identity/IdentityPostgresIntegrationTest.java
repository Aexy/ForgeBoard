package com.forgeboard.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.forgeboard.identity.application.OnboardingRequest;
import com.forgeboard.identity.application.OnboardingService;
import com.forgeboard.identity.application.OnboardingResult;
import com.forgeboard.identity.application.SessionLoginRequest;
import com.forgeboard.identity.security.ApiTokenService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.client.application.ClientRequest;
import com.forgeboard.client.application.ClientService;
import com.forgeboard.client.application.ClientView;
import com.forgeboard.work.application.BoardView;
import com.forgeboard.work.application.MoveWorkItemRequest;
import com.forgeboard.work.application.WorkItemRequest;
import com.forgeboard.work.application.WorkItemView;
import com.forgeboard.work.application.WorkflowRequest;
import com.forgeboard.work.application.WorkflowStageRequest;
import com.forgeboard.work.domain.StageAttention;
import com.forgeboard.work.application.WorkflowService;
import com.forgeboard.work.domain.WorkPriority;
import java.util.List;
import java.util.UUID;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class IdentityPostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired OnboardingService onboarding;
    @Autowired JdbcClient jdbc;
    @Autowired ClientService clients;
    @Autowired WorkflowService workflows;
    @Autowired ApiTokenService apiTokens;

    @Test
    void flywaySchemaPersistsOnboardingAndItsAuditEvent() {
        OnboardingResult onboarded = onboarding.createFirm(new OnboardingRequest("Hearth Accounting", "hearth-accounting",
                "owner@example.com", "Alex Owner", "correct horse battery"));
        SelectedTenant tenant = new SelectedTenant(onboarded.firmId(), onboarded.ownerId(),
                onboarded.ownerEmail(), MembershipRole.OWNER);
        ClientView client = clients.create(tenant,
                new ClientRequest("Northstar Studio GmbH", "Northstar Studio", "hello@northstar.at"));
        BoardView board = workflows.createWorkflow(tenant,
                new WorkflowRequest("Monthly bookkeeping", List.of(
                        new WorkflowStageRequest("Waiting", StageAttention.NONE),
                        new WorkflowStageRequest("Preparation", StageAttention.NONE),
                        new WorkflowStageRequest("Review", StageAttention.AWAITING_REVIEW))));
        WorkItemView item = workflows.createItem(tenant, board.id(), new WorkItemRequest(client.id(),
                board.stages().get(0).id(), "June bookkeeping", "", null, WorkPriority.NORMAL));
        workflows.moveItem(tenant, board.id(), item.id(),
                new MoveWorkItemRequest(board.stages().get(1).id(), null, null, item.version()));

        assertThat(count("firms")).isEqualTo(1);
        assertThat(count("users")).isEqualTo(1);
        assertThat(count("firm_memberships")).isEqualTo(1);
        assertThat(count("clients")).isEqualTo(1);
        assertThat(count("workflows")).isEqualTo(1);
        assertThat(count("workflow_stages")).isEqualTo(3);
        assertThat(count("work_items")).isEqualTo(1);
        assertThat(count("activity_events")).isEqualTo(5);
        assertThat(jdbc.sql("select stage_id from work_items where id = :id").param("id", item.id())
                .query(UUID.class).single()).isEqualTo(board.stages().get(1).id());
    }

    @Test
    void refreshTokensRotateOnceAndReplayRevokesTheFamily() {
        onboarding.createFirm(new OnboardingRequest("Token Firm", "token-firm", "tokens@example.com", "Token Owner",
                "correct horse battery"));
        ApiTokenService.ApiGrant grant = apiTokens.grant(new SessionLoginRequest("tokens@example.com", "correct horse battery"));

        ApiTokenService.ApiGrant replacement = apiTokens.refresh(grant.refreshToken());

        assertThat(replacement.refreshToken()).isNotEqualTo(grant.refreshToken());
        assertThat(count("api_refresh_tokens")).isEqualTo(2);
        assertThatThrownBy(() -> apiTokens.refresh(grant.refreshToken())).isInstanceOf(RuntimeException.class);
        assertThat(jdbc.sql("select count(*) from api_refresh_tokens where revoked_at is not null")
                .query(Long.class).single()).isEqualTo(2);
    }

    private long count(String table) {
        return jdbc.sql("select count(*) from " + table).query(Long.class).single();
    }
}
