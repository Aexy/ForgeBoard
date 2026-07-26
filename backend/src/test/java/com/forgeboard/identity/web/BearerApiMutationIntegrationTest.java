package com.forgeboard.identity.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.forgeboard.identity.application.OnboardingRequest;
import com.forgeboard.identity.application.OnboardingResult;
import com.forgeboard.identity.application.OnboardingService;
import com.forgeboard.identity.application.CreateEmployeeRequest;
import com.forgeboard.identity.application.EmployeeProvisioningService;
import com.forgeboard.identity.application.EmployeeView;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.security.TenantSelectionFilter;
import com.forgeboard.client.application.ClientRequest;
import com.forgeboard.client.application.ClientService;
import com.forgeboard.engagement.application.CreateEngagementRequest;
import com.forgeboard.engagement.application.EngagementService;
import com.forgeboard.engagement.application.EngagementTemplateRequest;
import com.forgeboard.engagement.application.EngagementView;
import com.forgeboard.engagement.domain.Recurrence;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.engagement.persistence.EngagementReviewDecisionRepository;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.persistence.ActivityEventRepository;
import com.forgeboard.work.application.AssignWorkItemRequest;
import com.forgeboard.work.application.AssignWorkItemRoleRequest;
import com.forgeboard.work.application.BoardView;
import com.forgeboard.work.application.WorkflowRequest;
import com.forgeboard.work.application.WorkflowService;
import com.forgeboard.work.application.WorkflowStageRequest;
import com.forgeboard.work.domain.StageAttention;
import com.forgeboard.work.domain.WorkItem;
import com.forgeboard.work.persistence.WorkItemRepository;
import com.forgeboard.work.persistence.SavedWorkflowViewRepository;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class BearerApiMutationIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("forgeboard.api-token.secret", () -> Base64.getEncoder().encodeToString(new byte[32]));
    }

    @Autowired MockMvc mockMvc;
    @Autowired OnboardingService onboarding;
    @Autowired SavedWorkflowViewRepository savedViews;
    @Autowired ClientService clients;
    @Autowired WorkflowService workflows;
    @Autowired EngagementService engagements;
    @Autowired EmployeeProvisioningService employees;
    @Autowired WorkItemRepository workItems;
    @Autowired EngagementRepository engagementRepository;
    @Autowired EngagementReviewDecisionRepository reviewDecisions;
    @Autowired ActivityEventRepository activityEvents;

    @Test
    void realBearerGrantAuthenticatesAndPersistsATenantScopedMutationWithoutACookie() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String email = "owner-" + suffix + "@example.com";
        OnboardingResult onboarded = onboarding.createFirm(new OnboardingRequest("Bearer Firm", "bearer-" + suffix,
                email, "Bearer Owner", "correct horse battery"));

        MvcResult grant = mockMvc.perform(post("/api/auth/grant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct horse battery\"}"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andReturn();
        String accessToken = accessToken(grant);

        mockMvc.perform(post("/api/workflows/views")
                        .header("Authorization", "Bearer " + accessToken)
                        .header(TenantSelectionFilter.FIRM_HEADER, onboarded.firmId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Overdue work\",\"dueState\":\"OVERDUE\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().doesNotExist("Set-Cookie"));

        assertThat(savedViews.findAllByFirmIdOrderByNameAsc(onboarded.firmId()))
                .extracting(view -> view.name())
                .containsExactly("Overdue work");
    }

    @Test
    void bearerLifecycleMoveRejectionsPreserveTenantScopedWorkHistoryAndAudit() throws Exception {
        LifecycleFixture fixture = lifecycleFixture();
        OnboardingResult anotherFirm = onboarding.createFirm(new OnboardingRequest("Other Firm", "other-" + UUID.randomUUID(),
                "other-" + UUID.randomUUID() + "@example.com", "Other Owner", "correct horse battery"));
        String otherToken = grant(anotherFirm.ownerEmail());
        long auditBeforeRejections = activityEvents.count();

        mockMvc.perform(patch(movePath(fixture.workflowId(), fixture.workItem().id()))
                        .header("Authorization", "Bearer " + fixture.reviewerToken())
                        .header(TenantSelectionFilter.FIRM_HEADER, fixture.firmId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(move(fixture.reviewStageId(), fixture.workItem().version(), null)))
                .andExpect(status().isForbidden());
        assertUnchanged(fixture, fixture.prepareStageId(), 0, auditBeforeRejections);

        mockMvc.perform(patch(movePath(fixture.workflowId(), fixture.workItem().id()))
                        .header("Authorization", "Bearer " + fixture.preparerToken())
                        .header(TenantSelectionFilter.FIRM_HEADER, fixture.firmId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(move(fixture.reviewStageId(), fixture.workItem().version(), null)))
                .andExpect(status().isOk());
        WorkItem awaitingReview = workItems.findByIdAndFirmIdAndWorkflowId(fixture.workItem().id(), fixture.firmId(), fixture.workflowId()).orElseThrow();
        long auditAfterSubmission = activityEvents.count();

        mockMvc.perform(patch(movePath(fixture.workflowId(), awaitingReview.id()))
                        .header("Authorization", "Bearer " + fixture.reviewerToken())
                        .header(TenantSelectionFilter.FIRM_HEADER, fixture.firmId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(move(fixture.prepareStageId(), awaitingReview.version(), "   ")))
                .andExpect(status().isConflict());
        assertUnchanged(fixture, fixture.reviewStageId(), 0, auditAfterSubmission);

        mockMvc.perform(post("/api/engagements/" + fixture.engagement().id() + "/cancel")
                        .header("Authorization", "Bearer " + fixture.ownerToken())
                        .header(TenantSelectionFilter.FIRM_HEADER, fixture.firmId())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":999}"))
                .andExpect(status().isConflict());
        assertUnchanged(fixture, fixture.reviewStageId(), 0, auditAfterSubmission);

        mockMvc.perform(patch(movePath(fixture.workflowId(), awaitingReview.id()))
                        .header("Authorization", "Bearer " + otherToken)
                        .header(TenantSelectionFilter.FIRM_HEADER, anotherFirm.firmId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(move(fixture.prepareStageId(), awaitingReview.version(), "note")))
                .andExpect(status().isNotFound());
        assertUnchanged(fixture, fixture.reviewStageId(), 0, auditAfterSubmission);
    }

    private LifecycleFixture lifecycleFixture() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String ownerEmail = "owner-" + suffix + "@example.com";
        OnboardingResult onboarded = onboarding.createFirm(new OnboardingRequest("Lifecycle Firm", "lifecycle-" + suffix,
                ownerEmail, "Lifecycle Owner", "correct horse battery"));
        SelectedTenant owner = new SelectedTenant(onboarded.firmId(), onboarded.ownerId(), ownerEmail, MembershipRole.OWNER);
        var client = clients.create(owner, new ClientRequest("Lifecycle Client", "Lifecycle Client", null));
        BoardView workflow = workflows.createWorkflow(owner, new WorkflowRequest("Lifecycle workflow", List.of(
                new WorkflowStageRequest("Prepare", StageAttention.NONE, false),
                new WorkflowStageRequest("Review", StageAttention.AWAITING_REVIEW, false),
                new WorkflowStageRequest("Complete", StageAttention.NONE, true))));
        EmployeeView preparer = employees.create(owner, new CreateEmployeeRequest("Preparer", "preparer-" + suffix + "@example.com",
                "correct horse battery", MembershipRole.MEMBER));
        EmployeeView reviewer = employees.create(owner, new CreateEmployeeRequest("Reviewer", "reviewer-" + suffix + "@example.com",
                "correct horse battery", MembershipRole.MEMBER));
        var template = engagements.createTemplate(owner, new EngagementTemplateRequest("Lifecycle template", workflow.id(),
                Recurrence.MONTHLY, "Prepare lifecycle", 20));
        EngagementView engagement = engagements.createEngagement(owner, template.id(),
                new CreateEngagementRequest(client.id(), LocalDate.of(2026, 7, 1)));
        workflows.assign(owner, workflow.id(), engagement.workItemId(), new AssignWorkItemRequest(preparer.userId()));
        workflows.assignReviewer(owner, workflow.id(), engagement.workItemId(), new AssignWorkItemRoleRequest(reviewer.userId()));
        WorkItem item = workItems.findByIdAndFirmIdAndWorkflowId(engagement.workItemId(), onboarded.firmId(), workflow.id()).orElseThrow();
        return new LifecycleFixture(onboarded.firmId(), workflow.id(), workflow.stages().get(0).id(), workflow.stages().get(1).id(),
                item, engagement, grant(ownerEmail), grant(preparer.email()), grant(reviewer.email()));
    }

    private void assertUnchanged(LifecycleFixture fixture, UUID expectedStageId, int expectedHistoryCount, long expectedAuditCount) {
        WorkItem item = workItems.findByIdAndFirmIdAndWorkflowId(fixture.workItem().id(), fixture.firmId(), fixture.workflowId()).orElseThrow();
        assertThat(item.stageId()).isEqualTo(expectedStageId);
        assertThat(engagementRepository.findByIdAndFirmId(fixture.engagement().id(), fixture.firmId()).orElseThrow().status().name())
                .isEqualTo(expectedStageId.equals(fixture.prepareStageId()) ? "ACTIVE" : "AWAITING_REVIEW");
        assertThat(reviewDecisions.findAllByFirmIdAndEngagementIdOrderByOccurredAtDescIdDesc(fixture.firmId(), fixture.engagement().id()))
                .hasSize(expectedHistoryCount);
        assertThat(activityEvents.count()).isEqualTo(expectedAuditCount);
    }

    private String move(UUID targetStageId, long expectedVersion, String note) {
        return "{\"targetStageId\":\"" + targetStageId + "\",\"expectedVersion\":" + expectedVersion
                + (note == null ? "" : ",\"reviewNote\":\"" + note + "\"") + "}";
    }

    private String movePath(UUID workflowId, UUID itemId) { return "/api/workflows/" + workflowId + "/items/" + itemId + "/position"; }

    private String grant(String email) throws Exception {
        MvcResult grant = mockMvc.perform(post("/api/auth/grant").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct horse battery\"}"))
                .andExpect(status().isOk()).andReturn();
        return accessToken(grant);
    }

    private record LifecycleFixture(UUID firmId, UUID workflowId, UUID prepareStageId, UUID reviewStageId, WorkItem workItem,
            EngagementView engagement, String ownerToken, String preparerToken, String reviewerToken) {}

    private String accessToken(MvcResult grant) throws Exception {
        Matcher token = Pattern.compile("\\\"accessToken\\\":\\\"([^\\\"]+)\\\"")
                .matcher(grant.getResponse().getContentAsString());
        assertThat(token.find()).isTrue();
        return token.group(1);
    }
}
