package com.forgeboard.work.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.forgeboard.client.application.ClientRequest;
import com.forgeboard.client.application.ClientService;
import com.forgeboard.client.application.ClientView;
import com.forgeboard.document.application.DocumentRequestInput;
import com.forgeboard.document.application.DocumentRequestService;
import com.forgeboard.document.application.DocumentRequestView;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.OnboardingRequest;
import com.forgeboard.identity.application.OnboardingResult;
import com.forgeboard.identity.application.OnboardingService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.work.application.BoardView;
import com.forgeboard.work.application.WorkItemRequest;
import com.forgeboard.work.application.WorkItemView;
import com.forgeboard.work.application.WorkflowRequest;
import com.forgeboard.work.application.WorkflowService;
import com.forgeboard.work.application.WorkflowStageRequest;
import com.forgeboard.work.domain.SavedWorkflowView;
import com.forgeboard.work.domain.StageAttention;
import com.forgeboard.work.domain.WorkItemDocumentRequest;
import com.forgeboard.work.domain.WorkPriority;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class WorkflowWorkspacePostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired OnboardingService onboarding;
    @Autowired ClientService clients;
    @Autowired WorkflowService workflows;
    @Autowired DocumentRequestService documentRequests;
    @Autowired WorkItemDocumentRequestRepository links;
    @Autowired SavedWorkflowViewRepository savedViews;

    @Test
    void serializesConcurrentNormalizedWorkflowSlugAllocationPerFirm() throws Exception {
        String unique = "slug-race-" + UUID.randomUUID();
        OnboardingResult result = onboarding.createFirm(new OnboardingRequest("Firm " + unique, unique,
                unique + "@example.com", "Owner", "correct horse battery"));
        SelectedTenant tenant = new SelectedTenant(result.firmId(), result.ownerId(), result.ownerEmail(), MembershipRole.OWNER);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<BoardView> first = executor.submit(() -> createWorkflowAfterStart(tenant, "Monthly bookkeeping", ready, start));
            Future<BoardView> second = executor.submit(() -> createWorkflowAfterStart(tenant, "Monthly-bookkeeping", ready, start));
            ready.await();
            start.countDown();

            assertThat(List.of(first.get().workflowSlug(), second.get().workflowSlug()))
                    .containsExactlyInAnyOrder("monthly-bookkeeping", "monthly-bookkeeping-2");
        }
    }

    @Test
    void enforcesOneTaskPerDocumentRequestAndFirmConsistentLinks() {
        Fixture first = createFixture("first");
        WorkItemView secondItem = workflows.createItem(first.tenant(), first.board().id(), new WorkItemRequest(
                first.client().id(), first.board().stages().getFirst().id(), "Second task", "", null, WorkPriority.NORMAL));
        DocumentRequestView request = documentRequests.create(first.tenant(), new DocumentRequestInput(
                first.client().id(), "Bank statement", null, null));

        links.saveAndFlush(new WorkItemDocumentRequest(first.tenant().firmId(), first.item().id(), request.id()));

        assertThat(links.findAllByFirmIdAndWorkItemId(first.tenant().firmId(), first.item().id()))
                .extracting(WorkItemDocumentRequest::documentRequestId)
                .containsExactly(request.id());
        assertThatThrownBy(() -> links.saveAndFlush(new WorkItemDocumentRequest(
                first.tenant().firmId(), secondItem.id(), request.id())))
                .isInstanceOf(DataIntegrityViolationException.class);

        Fixture other = createFixture("other");
        DocumentRequestView otherRequest = documentRequests.create(other.tenant(), new DocumentRequestInput(
                other.client().id(), "VAT return", null, null));

        assertThatThrownBy(() -> links.saveAndFlush(new WorkItemDocumentRequest(
                first.tenant().firmId(), first.item().id(), otherRequest.id())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void persistsFirmScopedSavedViewsWithTenantLocalNames() {
        Fixture first = createFixture("saved-first");
        Fixture other = createFixture("saved-other");

        SavedWorkflowView saved = savedViews.saveAndFlush(new SavedWorkflowView(UUID.randomUUID(), first.tenant().firmId(),
                "Overdue unassigned", first.client().id(), first.tenant().userId(), "OVERDUE", WorkPriority.HIGH,
                true, first.tenant().userId(), Instant.now()));
        savedViews.saveAndFlush(new SavedWorkflowView(UUID.randomUUID(), other.tenant().firmId(),
                "Overdue unassigned", other.client().id(), other.tenant().userId(), "DUE_SOON", null,
                false, other.tenant().userId(), Instant.now()));

        assertThat(savedViews.findAllByFirmIdOrderByNameAsc(first.tenant().firmId()))
                .extracting(SavedWorkflowView::id)
                .contains(saved.id());
        assertThat(savedViews.findByIdAndFirmId(saved.id(), other.tenant().firmId())).isEmpty();
        assertThatThrownBy(() -> savedViews.saveAndFlush(new SavedWorkflowView(UUID.randomUUID(), first.tenant().firmId(),
                "Overdue unassigned", null, null, null, null, null, first.tenant().userId(), Instant.now())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private Fixture createFixture(String suffix) {
        String unique = suffix + "-" + UUID.randomUUID();
        OnboardingResult result = onboarding.createFirm(new OnboardingRequest("Firm " + unique, unique,
                unique + "@example.com", "Owner " + suffix, "correct horse battery"));
        SelectedTenant tenant = new SelectedTenant(result.firmId(), result.ownerId(), result.ownerEmail(), MembershipRole.OWNER);
        ClientView client = clients.create(tenant, new ClientRequest("Client " + unique, "Client " + suffix, null));
        BoardView board = workflows.createWorkflow(tenant, new WorkflowRequest("Workflow " + unique, List.of(
                new WorkflowStageRequest("Preparation", StageAttention.NONE))));
        WorkItemView item = workflows.createItem(tenant, board.id(), new WorkItemRequest(client.id(),
                board.stages().getFirst().id(), "First task", "", null, WorkPriority.NORMAL));
        return new Fixture(tenant, client, board, item);
    }

    private BoardView createWorkflowAfterStart(SelectedTenant tenant, String name, CountDownLatch ready,
            CountDownLatch start) throws InterruptedException {
        ready.countDown();
        start.await();
        return workflows.createWorkflow(tenant, new WorkflowRequest(name, List.of(
                new WorkflowStageRequest("Preparation", StageAttention.NONE))));
    }

    private record Fixture(SelectedTenant tenant, ClientView client, BoardView board, WorkItemView item) {
    }
}
