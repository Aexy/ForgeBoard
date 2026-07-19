package com.forgeboard.work.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.forgeboard.document.DocumentRequestSummary;
import com.forgeboard.identity.ActivitySummary;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.domain.AssignmentRole;
import com.forgeboard.work.domain.StageAttention;
import com.forgeboard.work.domain.WorkItem;
import com.forgeboard.work.domain.WorkPriority;
import com.forgeboard.work.domain.WorkflowBoard;
import com.forgeboard.work.domain.WorkflowStage;

class WorkflowBoardReaderTest {
    private WorkflowServiceFixture fixture;
    private WorkflowBoardReader reader;
    private SelectedTenant tenant;
    private Instant now;

    @BeforeEach
    void setUp() {
        now = Instant.parse("2026-07-19T10:00:00Z");
        fixture = new WorkflowServiceFixture(now);
        tenant = fixture.tenant;
        reader = fixture.reader();
    }

    @Test
    void projectsStagesAndItemsInRepositoryRankOrderWithOwnerAndReviewerNames() {
        UUID workflowId = UUID.randomUUID();
        UUID firstStageId = UUID.randomUUID();
        UUID secondStageId = UUID.randomUUID();
        UUID firstItemId = UUID.randomUUID();
        UUID secondItemId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        WorkflowBoard workflow = new WorkflowBoard(workflowId, tenant.firmId(), "Monthly close", "monthly-close", now);
        WorkItem first = item(firstItemId, workflowId, firstStageId, "1000", "FB-1042");
        WorkItem second = item(secondItemId, workflowId, firstStageId, "2000", "FB-1043");
        when(fixture.workflows.findByFirmIdAndWorkflowSlug(tenant.firmId(), "monthly-close")).thenReturn(Optional.of(workflow));
        when(fixture.workflows.findByIdAndFirmId(workflowId, tenant.firmId())).thenReturn(Optional.of(workflow));
        when(fixture.stages.findAllByFirmIdAndWorkflowIdOrderByPositionAsc(tenant.firmId(), workflowId)).thenReturn(List.of(
                new WorkflowStage(firstStageId, tenant.firmId(), workflowId, "Preparation", StageAttention.NONE, 0, now),
                new WorkflowStage(secondStageId, tenant.firmId(), workflowId, "Review", StageAttention.AWAITING_REVIEW, 1, now)));
        when(fixture.items.findAllByFirmIdAndWorkflowIdOrderByStageIdAscRankAscIdAsc(tenant.firmId(), workflowId)).thenReturn(List.of(first, second));
        when(fixture.assignments.findRolesByFirmIdAndWorkItemIdIn(tenant.firmId(), List.of(firstItemId, secondItemId))).thenReturn(List.of(
                new WorkItemRoleAssignmentView(firstItemId, ownerId, AssignmentRole.OWNER),
                new WorkItemRoleAssignmentView(firstItemId, reviewerId, AssignmentRole.REVIEWER)));
        when(fixture.employees.displayNames(tenant.firmId(), List.of(ownerId, reviewerId))).thenReturn(Map.of(ownerId, "Mira Miller", reviewerId, "Robin Reviewer"));

        BoardView board = reader.getBoard(tenant, "monthly-close");

        assertThat(board.stages()).extracting(StageView::name).containsExactly("Preparation", "Review");
        assertThat(board.stages().getFirst().items()).extracting(WorkItemView::taskReference).containsExactly("FB-1042", "FB-1043");
        assertThat(board.stages().getFirst().items().getFirst()).extracting(WorkItemView::ownerDisplayName, WorkItemView::reviewerDisplayName)
                .containsExactly("Mira Miller", "Robin Reviewer");
    }

    @Test
    void projectsDetailWithLinkedDocumentsAndNewestActivityFirst() {
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        WorkflowBoard workflow = new WorkflowBoard(workflowId, tenant.firmId(), "Monthly close", "monthly-close", now);
        WorkItem item = item(itemId, workflowId, UUID.randomUUID(), "1000", "FB-1042");
        when(fixture.workflows.findByFirmIdAndWorkflowSlug(tenant.firmId(), "monthly-close")).thenReturn(Optional.of(workflow));
        when(fixture.items.findByFirmIdAndWorkflowIdAndTaskReference(tenant.firmId(), workflowId, "FB-1042")).thenReturn(Optional.of(item));
        when(fixture.items.findByIdAndFirmIdAndWorkflowId(itemId, tenant.firmId(), workflowId)).thenReturn(Optional.of(item));
        when(fixture.clients.displayName(tenant.firmId(), item.clientId())).thenReturn(Optional.of("Acme Ltd"));
        when(fixture.documentLinks.findAllByFirmIdAndWorkItemId(tenant.firmId(), itemId)).thenReturn(List.of(
                new com.forgeboard.work.domain.WorkItemDocumentRequest(tenant.firmId(), itemId, requestId)));
        when(fixture.documentRequests.find(tenant.firmId(), requestId)).thenReturn(Optional.of(
                new DocumentRequestSummary(requestId, item.clientId(), "Bank statement", null, "REQUESTED", null)));
        when(fixture.assignments.findRolesByFirmIdAndWorkItemIdIn(tenant.firmId(), List.of(itemId))).thenReturn(List.of());
        ActivitySummary newest = new ActivitySummary(tenant.userId(), "USER", "REST", "work-item.updated", "work-item", itemId,
                Map.of(), now);
        ActivitySummary older = new ActivitySummary(tenant.userId(), "USER", "REST", "work-item.created", "work-item", itemId,
                Map.of(), now.minusSeconds(60));
        when(fixture.activityQueries.recent(tenant, "work-item", itemId)).thenReturn(List.of(newest, older));

        WorkItemDetailView detail = reader.getItemDetail(tenant, "monthly-close", "FB-1042");

        assertThat(detail.clientDisplayName()).isEqualTo("Acme Ltd");
        assertThat(detail.documentRequests()).extracting(DocumentRequestSummaryView::label).containsExactly("Bank statement");
        assertThat(detail.activity()).extracting(ActivitySummary::action).containsExactly("work-item.updated", "work-item.created");
    }

    @Test
    void returnsNotFoundForCrossFirmAndWrongWorkflowLookups() {
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        SelectedTenant otherFirmTenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "other@example.com", MembershipRole.OWNER);
        when(fixture.items.findByIdAndFirmIdAndWorkflowId(itemId, otherFirmTenant.firmId(), workflowId)).thenReturn(Optional.empty());
        when(fixture.workflows.findByFirmIdAndWorkflowSlug(tenant.firmId(), "monthly-close")).thenReturn(Optional.of(
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly close", "monthly-close", now)));
        when(fixture.items.findByFirmIdAndWorkflowIdAndTaskReference(tenant.firmId(), workflowId, "FB-1042")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reader.getItemDetail(otherFirmTenant, workflowId, itemId)).isInstanceOf(WorkNotFoundException.class);
        assertThatThrownBy(() -> reader.getItemDetail(tenant, "monthly-close", "FB-1042")).isInstanceOf(WorkNotFoundException.class);
    }

    @Test
    void preservesNotFoundBehaviorForMissingClientAndLinkedDocument() {
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        WorkItem item = item(itemId, workflowId, UUID.randomUUID(), "1000", "FB-1042");
        when(fixture.items.findByIdAndFirmIdAndWorkflowId(itemId, tenant.firmId(), workflowId)).thenReturn(Optional.of(item));
        when(fixture.clients.displayName(tenant.firmId(), item.clientId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reader.getItemDetail(tenant, workflowId, itemId)).isInstanceOf(WorkNotFoundException.class);

        when(fixture.clients.displayName(tenant.firmId(), item.clientId())).thenReturn(Optional.of("Acme Ltd"));
        when(fixture.documentLinks.findAllByFirmIdAndWorkItemId(tenant.firmId(), itemId)).thenReturn(List.of(
                new com.forgeboard.work.domain.WorkItemDocumentRequest(tenant.firmId(), itemId, requestId)));
        when(fixture.documentRequests.find(tenant.firmId(), requestId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reader.getItemDetail(tenant, workflowId, itemId)).isInstanceOf(WorkNotFoundException.class);
    }

    private WorkItem item(UUID id, UUID workflowId, UUID stageId, String rank, String reference) {
        return new WorkItem(id, tenant.firmId(), UUID.randomUUID(), workflowId, stageId, "Item", "", null,
                WorkPriority.NORMAL, new BigDecimal(rank), reference, now);
    }
}
