package com.forgeboard.identity.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import com.forgeboard.identity.application.EmployeeProvisioningService;
import com.forgeboard.identity.application.AcceptInvitationRequest;
import com.forgeboard.identity.application.AccessLifecycleService;
import com.forgeboard.identity.application.GeneratedAccessLink;
import com.forgeboard.identity.application.InviteMemberRequest;
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
import com.forgeboard.identity.persistence.UserRepository;
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
        registry.add("forgeboard.platform-admin.emails", () -> "platform-admin@forgeboard.test");
    }

    @Autowired MockMvc mockMvc;
    @Autowired OnboardingService onboarding;
    @Autowired SavedWorkflowViewRepository savedViews;
    @Autowired ClientService clients;
    @Autowired WorkflowService workflows;
    @Autowired EngagementService engagements;
    @Autowired EmployeeProvisioningService employees;
    @Autowired AccessLifecycleService accessLifecycle;
    @Autowired UserRepository users;
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
        String preparerEmail = "preparer-" + suffix + "@example.com";
        String reviewerEmail = "reviewer-" + suffix + "@example.com";
        UUID preparerId = acceptInvitation(owner, "Preparer", preparerEmail);
        UUID reviewerId = acceptInvitation(owner, "Reviewer", reviewerEmail);
        var template = engagements.createTemplate(owner, new EngagementTemplateRequest("Lifecycle template", workflow.id(),
                Recurrence.MONTHLY, "Prepare lifecycle", 20));
        EngagementView engagement = engagements.createEngagement(owner, template.id(),
                new CreateEngagementRequest(client.id(), LocalDate.of(2026, 7, 1)));
        workflows.assign(owner, workflow.id(), engagement.workItemId(), new AssignWorkItemRequest(preparerId));
        workflows.assignReviewer(owner, workflow.id(), engagement.workItemId(), new AssignWorkItemRoleRequest(reviewerId));
        WorkItem item = workItems.findByIdAndFirmIdAndWorkflowId(engagement.workItemId(), onboarded.firmId(), workflow.id()).orElseThrow();
        return new LifecycleFixture(onboarded.firmId(), workflow.id(), workflow.stages().get(0).id(), workflow.stages().get(1).id(),
                item, engagement, grant(ownerEmail), grant(preparerEmail), grant(reviewerEmail));
    }

    @Test
    void bearerAccessManagementEnforcesRoleAndTenantBoundariesAndPlatformResetRevokesSessions() throws Exception {
        String suffix = UUID.randomUUID().toString();
        OnboardingResult firm = onboarding.createFirm(new OnboardingRequest("Access Firm", "access-" + suffix,
                "owner-" + suffix + "@example.com", "Access Owner", "correct horse battery"));
        String ownerToken = grant(firm.ownerEmail());
        String adminEmail = "administrator-" + suffix + "@example.com";

        MvcResult invitation = mockMvc.perform(post("/api/identity/employees")
                        .header("Authorization", "Bearer " + ownerToken)
                        .header(TenantSelectionFilter.FIRM_HEADER, firm.firmId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Access Administrator\",\"email\":\"" + adminEmail
                                + "\",\"role\":\"ADMINISTRATOR\"}"))
                .andExpect(status().isCreated()).andReturn();
        accessLifecycle.acceptNewAccountInvitation(new AcceptInvitationRequest(accessLinkToken(invitation),
                "Access Administrator", "correct horse battery"));
        String administratorToken = grant(adminEmail);
        MvcResult employeesInFirm = mockMvc.perform(get("/api/identity/employees")
                        .header("Authorization", "Bearer " + ownerToken)
                        .header(TenantSelectionFilter.FIRM_HEADER, firm.firmId()))
                .andExpect(status().isOk()).andReturn();
        UUID administratorMembershipId = membershipId(employeesInFirm, adminEmail);

        mockMvc.perform(post("/api/identity/employees")
                        .header("Authorization", "Bearer " + administratorToken)
                        .header(TenantSelectionFilter.FIRM_HEADER, firm.firmId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Prohibited Owner\",\"email\":\"prohibited-" + suffix
                                + "@example.com\",\"role\":\"OWNER\"}"))
                .andExpect(status().isForbidden());

        OnboardingResult otherFirm = onboarding.createFirm(new OnboardingRequest("Other Access Firm", "other-access-" + suffix,
                "other-owner-" + suffix + "@example.com", "Other Owner", "correct horse battery"));
        mockMvc.perform(post("/api/identity/employees/" + administratorMembershipId + "/suspension")
                        .header("Authorization", "Bearer " + grant(otherFirm.ownerEmail()))
                        .header(TenantSelectionFilter.FIRM_HEADER, otherFirm.firmId()))
                .andExpect(status().isNotFound());

        OnboardingResult platformFirm = onboarding.createFirm(new OnboardingRequest("Platform Firm", "platform-" + suffix,
                "platform-admin@forgeboard.test", "Platform Administrator", "correct horse battery"));
        String targetToken = ownerToken;
        UUID targetUserId = firm.ownerId();
        MvcResult reset = mockMvc.perform(post("/api/platform-admin/users/" + targetUserId + "/password-reset")
                        .header("Authorization", "Bearer " + grant(platformFirm.ownerEmail())))
                .andExpect(status().isOk()).andReturn();
        String resetToken = accessLinkToken(reset);

        mockMvc.perform(post("/api/access/password-resets/" + resetToken + "/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"new correct horse battery\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/identity/me")
                        .header("Authorization", "Bearer " + targetToken)
                        .header(TenantSelectionFilter.FIRM_HEADER, firm.firmId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/grant").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + firm.ownerEmail()
                                + "\",\"password\":\"correct horse battery\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/grant").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + firm.ownerEmail()
                                + "\",\"password\":\"new correct horse battery\"}"))
                .andExpect(status().isOk());
    }

    private UUID acceptInvitation(SelectedTenant owner, String displayName, String email) {
        GeneratedAccessLink invitation = employees.create(owner,
                new InviteMemberRequest(displayName, email, MembershipRole.MEMBER));
        String token = invitation.link().substring(invitation.link().lastIndexOf('/') + 1);
        accessLifecycle.acceptNewAccountInvitation(new AcceptInvitationRequest(token, displayName, "correct horse battery"));
        return users.findByEmail(email).orElseThrow().id();
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

    private String accessLinkToken(MvcResult response) throws Exception {
        Matcher link = Pattern.compile("\\\"link\\\":\\\"([^\\\"]+)\\\"")
                .matcher(response.getResponse().getContentAsString());
        assertThat(link.find()).isTrue();
        String rawLink = link.group(1).replace("\\/", "/");
        return rawLink.substring(rawLink.lastIndexOf('/') + 1);
    }

    private UUID membershipId(MvcResult response, String email) throws Exception {
        Matcher membership = Pattern.compile("\\\"membershipId\\\":\\\"([^\\\"]+)\\\"[^}]*\\\"email\\\":\\\""
                + Pattern.quote(email) + "\\\"").matcher(response.getResponse().getContentAsString());
        assertThat(membership.find()).isTrue();
        return UUID.fromString(membership.group(1));
    }
}
