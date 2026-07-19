package com.forgeboard.work.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.forgeboard.client.ClientDirectory;
import com.forgeboard.document.DocumentRequestDirectory;
import com.forgeboard.document.DocumentRequestSummary;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.ActivityDirectory;
import com.forgeboard.identity.EmployeeDirectory;
import com.forgeboard.identity.FirmDirectory;
import com.forgeboard.identity.MembershipAccess;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.domain.AssignmentRole;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.work.domain.WorkItem;
import com.forgeboard.work.domain.WorkPriority;
import com.forgeboard.work.domain.StageAttention;
import com.forgeboard.work.domain.WorkflowBoard;
import com.forgeboard.work.domain.WorkflowStage;
import com.forgeboard.work.persistence.WorkItemRepository;
import com.forgeboard.work.persistence.WorkItemAssignmentRepository;
import com.forgeboard.work.persistence.WorkItemDocumentRequestRepository;
import com.forgeboard.work.persistence.SavedWorkflowViewRepository;
import com.forgeboard.work.persistence.WorkflowRepository;
import com.forgeboard.work.persistence.WorkflowStageRepository;

class WorkflowServiceTest {
    WorkflowRepository workflows;
    WorkflowStageRepository stages;
    WorkItemRepository items;
    ClientDirectory clients;
    ActivityRecorder activity;
    MembershipAccess membershipAccess;
    WorkItemAssignmentRepository assignments;
    EmployeeDirectory employees;
    DocumentRequestDirectory documentRequests;
    WorkItemDocumentRequestRepository documentLinks;
    ActivityDirectory activityQueries;
    SavedWorkflowViewRepository savedViews;
    FirmDirectory firms;
    WorkflowService service;
    SelectedTenant tenant;
    Instant now;

    @BeforeEach
    void setUp() {
        now = Instant.parse("2026-07-12T22:00:00Z");
        WorkflowServiceFixture fixture = new WorkflowServiceFixture(now);
        workflows = fixture.workflows;
        stages = fixture.stages;
        items = fixture.items;
        clients = fixture.clients;
        activity = fixture.activity;
        membershipAccess = fixture.membershipAccess;
        assignments = fixture.assignments;
        employees = fixture.employees;
        documentRequests = fixture.documentRequests;
        documentLinks = fixture.documentLinks;
        activityQueries = fixture.activityQueries;
        savedViews = fixture.savedViews;
        firms = fixture.firms;
        tenant = fixture.tenant;
        service = fixture.service();
    }

    @Test
    void listsSharedViewsForAnySelectedFirmMember() {
        var member = new SelectedTenant(tenant.firmId(), UUID.randomUUID(), "member@example.com", MembershipRole.MEMBER);
        var saved = new com.forgeboard.work.domain.SavedWorkflowView(UUID.randomUUID(), tenant.firmId(), "Unassigned",
                null, null, "OVERDUE", WorkPriority.HIGH, true, tenant.userId(), now);
        when(savedViews.findAllByFirmIdOrderByNameAsc(tenant.firmId())).thenReturn(List.of(saved));

        List<WorkflowFilterView> result = service.listSavedViews(member);

        assertThat(result).containsExactly(new WorkflowFilterView(saved.id(), "Unassigned", null, null,
                "OVERDUE", WorkPriority.HIGH, true));
        verify(savedViews).findAllByFirmIdOrderByNameAsc(tenant.firmId());
    }

    @Test
    void createsFirmScopedSharedViewAndRecordsOnlySafeAuditDetails() {
        UUID clientId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        when(clients.exists(tenant.firmId(), clientId)).thenReturn(true);
        when(membershipAccess.belongsToFirm(tenant.firmId(), ownerId)).thenReturn(true);
        when(savedViews.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        WorkflowFilterView created = service.createSavedView(tenant, new CreateWorkflowFilterRequest("Overdue owned work",
                clientId, ownerId, "OVERDUE", WorkPriority.HIGH, false));

        assertThat(created.name()).isEqualTo("Overdue owned work");
        assertThat(created.clientId()).isEqualTo(clientId);
        verify(membershipAccess).requireWorkflowViewManagement(tenant);
        verify(savedViews).save(any(com.forgeboard.work.domain.SavedWorkflowView.class));
        verify(activity).recordRestUserAction(tenant.firmId(), tenant.userId(), "workflow-view.created", "workflow-view",
                created.id(), Map.of("name", "Overdue owned work"));
    }

    @Test
    void rejectsSavedViewOwnerOutsideSelectedFirm() {
        UUID ownerId = UUID.randomUUID();
        when(membershipAccess.belongsToFirm(tenant.firmId(), ownerId)).thenReturn(false);

        assertThatThrownBy(() -> service.createSavedView(tenant, new CreateWorkflowFilterRequest("My view", null,
                ownerId, null, null, null))).isInstanceOf(WorkNotFoundException.class);

        verify(savedViews, never()).save(any());
    }

    @Test
    void deletesOnlyASavedViewFromTheSelectedFirm() {
        UUID viewId = UUID.randomUUID();
        var saved = new com.forgeboard.work.domain.SavedWorkflowView(viewId, tenant.firmId(), "Overdue",
                null, null, null, null, null, tenant.userId(), now);
        when(savedViews.findByIdAndFirmId(viewId, tenant.firmId())).thenReturn(Optional.of(saved));

        service.deleteSavedView(tenant, viewId);

        verify(savedViews).deleteByIdAndFirmId(viewId, tenant.firmId());
        verify(activity).recordRestUserAction(tenant.firmId(), tenant.userId(), "workflow-view.deleted", "workflow-view",
                viewId, Map.of("name", "Overdue"));
    }

    @Test
    void returnsNotFoundWhenDeletingAnotherFirmsSavedView() {
        UUID viewId = UUID.randomUUID();
        when(savedViews.findByIdAndFirmId(viewId, tenant.firmId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteSavedView(tenant, viewId)).isInstanceOf(WorkNotFoundException.class);

        verify(savedViews, never()).deleteByIdAndFirmId(any(), any());
    }

    @Test
    void createsAnOrderedWorkflowAndAuditEvent() {
        mockFirmSlugLock();
        when(workflows.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(stages.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        BoardView board = service.createWorkflow(tenant,
                new WorkflowRequest("Monthly bookkeeping", List.of(
                        new WorkflowStageRequest("Client dependency", StageAttention.BLOCKED),
                        new WorkflowStageRequest("Quality check", StageAttention.AWAITING_REVIEW))));

        assertThat(board.stages()).extracting(StageView::position).containsExactly(0, 1);
        assertThat(board.stages()).extracting(StageView::attention)
                .containsExactly(StageAttention.BLOCKED, StageAttention.AWAITING_REVIEW);
        verify(activity).recordRestUserAction(any(), any(), any(), any(), any(), any());
    }

    @Test
    void normalizesWorkflowSlugsAndDisambiguatesFirmLocalCollisions() {
        mockFirmSlugLock();
        when(workflows.existsByFirmIdAndWorkflowSlug(tenant.firmId(), "monthly-bookkeeping")).thenReturn(true);
        when(workflows.existsByFirmIdAndWorkflowSlug(tenant.firmId(), "monthly-bookkeeping-2")).thenReturn(false);
        when(workflows.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        BoardView board = service.createWorkflow(tenant, new WorkflowRequest(" Monthly bookkeeping! ", List.of()));

        assertThat(board.workflowSlug()).isEqualTo("monthly-bookkeeping-2");
        verify(workflows).existsByFirmIdAndWorkflowSlug(tenant.firmId(), "monthly-bookkeeping");
        verify(workflows).existsByFirmIdAndWorkflowSlug(tenant.firmId(), "monthly-bookkeeping-2");
        verify(firms).lockExisting(tenant.firmId());
    }

    @Test
    void createsAWorkItemOnlyWithTenantScopedRelations() {
        UUID workflowId = UUID.randomUUID();
        UUID stageId = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();
        when(workflows.findByIdAndFirmId(workflowId, tenant.firmId())).thenReturn(Optional.of(
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", "monthly", now)));
        when(stages.findByIdAndFirmIdAndWorkflowIdForUpdate(stageId, tenant.firmId(), workflowId)).thenReturn(Optional.of(
                new WorkflowStage(stageId, tenant.firmId(), workflowId, "Waiting", StageAttention.NONE, 0, now)));
        when(clients.exists(tenant.firmId(), clientId)).thenReturn(true);
        when(items.maximumRank(tenant.firmId(), workflowId, stageId)).thenReturn(Optional.empty());
        when(items.allocateTaskReference()).thenReturn("FB-1042");
        when(items.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemView created = service.createItem(tenant, workflowId,
                new WorkItemRequest(clientId, stageId, "June bookkeeping", "", null, WorkPriority.NORMAL));

        assertThat(created.rank()).isEqualByComparingTo("1000");
        assertThat(created.clientId()).isEqualTo(clientId);
        assertThat(created.taskReference()).isEqualTo("FB-1042");
    }

    @Test
    void resolvesPublicWorkflowAndTaskValuesOnlyWithinTheSelectedFirmAndParentWorkflow() {
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        WorkflowBoard workflow = new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", "monthly", now);
        WorkItem item = new WorkItem(itemId, tenant.firmId(), UUID.randomUUID(), workflowId, UUID.randomUUID(),
                "Item", "", null, WorkPriority.NORMAL, BigDecimal.ONE, "FB-1042", now);
        when(workflows.findByFirmIdAndWorkflowSlug(tenant.firmId(), "monthly")).thenReturn(Optional.of(workflow));
        when(items.findByFirmIdAndWorkflowIdAndTaskReference(tenant.firmId(), workflowId, "FB-1042"))
                .thenReturn(Optional.of(item));
        when(items.findByIdAndFirmIdAndWorkflowId(itemId, tenant.firmId(), workflowId)).thenReturn(Optional.of(item));
        when(clients.displayName(tenant.firmId(), item.clientId())).thenReturn(Optional.of("Client"));
        when(documentLinks.findAllByFirmIdAndWorkItemId(tenant.firmId(), itemId)).thenReturn(List.of());
        when(activityQueries.recent(tenant, "work-item", itemId)).thenReturn(List.of());
        when(assignments.findRolesByFirmIdAndWorkItemIdIn(tenant.firmId(), List.of(itemId))).thenReturn(List.of());
        when(assignments.findOwnersByFirmIdAndWorkItemIdIn(tenant.firmId(), List.of(itemId))).thenReturn(List.of());

        WorkItemDetailView detail = service.getItemDetail(tenant, "monthly", "FB-1042");

        assertThat(detail.item().taskReference()).isEqualTo("FB-1042");
        verify(items).findByFirmIdAndWorkflowIdAndTaskReference(tenant.firmId(), workflowId, "FB-1042");
    }

    @Test
    void returnsNotFoundForAPublicWorkflowOutsideTheSelectedFirm() {
        when(workflows.findByFirmIdAndWorkflowSlug(tenant.firmId(), "other-firm-workflow")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getBoard(tenant, "other-firm-workflow"))
                .isInstanceOf(WorkNotFoundException.class);
    }

    @Test
    void returnsNotFoundForAPublicTaskFromAnotherWorkflowInTheSelectedFirm() {
        UUID workflowId = UUID.randomUUID();
        when(workflows.findByFirmIdAndWorkflowSlug(tenant.firmId(), "monthly")).thenReturn(Optional.of(
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", "monthly", now)));
        when(items.findByFirmIdAndWorkflowIdAndTaskReference(tenant.firmId(), workflowId, "FB-1042"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getItemDetail(tenant, "monthly", "FB-1042"))
                .isInstanceOf(WorkNotFoundException.class);
    }

    @Test
    void returnsNotFoundForAPublicTaskFromAnotherFirm() {
        when(workflows.findByFirmIdAndWorkflowSlug(tenant.firmId(), "other-firm-workflow"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getItemDetail(tenant, "other-firm-workflow", "FB-1042"))
                .isInstanceOf(WorkNotFoundException.class);
        verifyNoInteractions(items);
    }

    @Test
    void rejectsAWorkflowFromAnotherFirm() {
        UUID workflowId = UUID.randomUUID();
        when(workflows.findByIdAndFirmId(workflowId, tenant.firmId())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getBoard(tenant, workflowId)).isInstanceOf(WorkNotFoundException.class);
    }

    @Test
    void calculatesAStableRankBetweenNeighbors() {
        UUID workflowId = UUID.randomUUID();
        UUID stageId = UUID.randomUUID();
        UUID movingId = UUID.randomUUID();
        WorkItem moving = item(movingId, workflowId, stageId, "3000");
        WorkItem before = item(UUID.randomUUID(), workflowId, stageId, "1000");
        WorkItem after = item(UUID.randomUUID(), workflowId, stageId, "2000");
        when(workflows.findByIdAndFirmId(workflowId, tenant.firmId())).thenReturn(Optional.of(
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", "monthly", now)));
        when(stages.findByIdAndFirmIdAndWorkflowIdForUpdate(stageId, tenant.firmId(), workflowId)).thenReturn(Optional.of(
                new WorkflowStage(stageId, tenant.firmId(), workflowId, "Review", StageAttention.AWAITING_REVIEW, 2, now)));
        when(items.findByIdAndFirmIdAndWorkflowId(movingId, tenant.firmId(), workflowId)).thenReturn(Optional.of(moving));
        when(items.findByIdAndFirmIdAndWorkflowId(before.id(), tenant.firmId(), workflowId)).thenReturn(Optional.of(before));
        when(items.findByIdAndFirmIdAndWorkflowId(after.id(), tenant.firmId(), workflowId)).thenReturn(Optional.of(after));

        WorkItemView moved = service.moveItem(tenant, workflowId, movingId,
                new MoveWorkItemRequest(stageId, before.id(), after.id(), moving.version()));
        assertThat(moved.rank()).isEqualByComparingTo("1500");
    }

    @Test
    void rejectsAStaleMoveBeforeRecordingAnAuditEvent() {
        UUID workflowId = UUID.randomUUID();
        UUID stageId = UUID.randomUUID();
        UUID movingId = UUID.randomUUID();
        WorkItem moving = item(movingId, workflowId, stageId, "1000");
        when(workflows.findByIdAndFirmId(workflowId, tenant.firmId())).thenReturn(Optional.of(
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", "monthly", now)));
        when(stages.findByIdAndFirmIdAndWorkflowIdForUpdate(stageId, tenant.firmId(), workflowId)).thenReturn(Optional.of(
                new WorkflowStage(stageId, tenant.firmId(), workflowId, "Review", StageAttention.AWAITING_REVIEW, 2, now)));
        when(items.findByIdAndFirmIdAndWorkflowId(movingId, tenant.firmId(), workflowId)).thenReturn(Optional.of(moving));

        assertThatThrownBy(() -> service.moveItem(tenant, workflowId, movingId,
                new MoveWorkItemRequest(stageId, null, null, moving.version() + 1)))
                .isInstanceOf(WorkItemConflictException.class);
        verify(activity, never()).recordRestUserAction(any(), any(), any(), any(), any(), any());
    }

    @Test
    void removesTheCurrentOwnerAndRecordsAnUnassignmentAuditEvent() {
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        WorkItem item = item(itemId, workflowId, UUID.randomUUID(), "1000");
        when(items.findByIdAndFirmIdAndWorkflowId(itemId, tenant.firmId(), workflowId)).thenReturn(Optional.of(item));

        WorkItemView unassigned = service.assign(tenant, workflowId, itemId, new AssignWorkItemRequest(null));

        assertThat(unassigned.ownerUserId()).isNull();
        verify(assignments).deleteByFirmIdAndWorkItemIdAndAssignmentRole(tenant.firmId(), itemId, AssignmentRole.OWNER);
        verify(assignments, never()).save(any());
        verify(activity).recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.unassigned", "work-item", itemId,
                java.util.Map.of());
    }

    @Test
    void assignsOnlyAnEmployeeFromTheSelectedFirm() {
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();
        WorkItem item = item(itemId, workflowId, UUID.randomUUID(), "1000");
        when(items.findByIdAndFirmIdAndWorkflowId(itemId, tenant.firmId(), workflowId)).thenReturn(Optional.of(item));
        when(membershipAccess.belongsToFirm(tenant.firmId(), employeeId)).thenReturn(true);

        WorkItemView assigned = service.assign(tenant, workflowId, itemId, new AssignWorkItemRequest(employeeId));

        assertThat(assigned.ownerUserId()).isEqualTo(employeeId);
        verify(assignments).save(any());
        verify(activity).recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.assigned", "work-item", itemId,
                java.util.Map.of("ownerUserId", employeeId.toString()));
    }

    @Test
    void includesTheAssignedOwnersDisplayNameInTheTenantScopedBoard() {
        UUID workflowId = UUID.randomUUID();
        UUID stageId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();
        WorkItem boardItem = item(itemId, workflowId, stageId, "1000");
        when(workflows.findByIdAndFirmId(workflowId, tenant.firmId())).thenReturn(Optional.of(
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", "monthly", now)));
        when(stages.findAllByFirmIdAndWorkflowIdOrderByPositionAsc(tenant.firmId(), workflowId)).thenReturn(List.of(
                new WorkflowStage(stageId, tenant.firmId(), workflowId, "Preparation", StageAttention.NONE, 0, now)));
        when(items.findAllByFirmIdAndWorkflowIdOrderByStageIdAscRankAscIdAsc(tenant.firmId(), workflowId))
                .thenReturn(List.of(boardItem));
        when(assignments.findOwnersByFirmIdAndWorkItemIdIn(tenant.firmId(), List.of(itemId)))
                .thenReturn(List.of(new OwnerAssignmentView(itemId, employeeId)));
        when(employees.displayNames(tenant.firmId(), List.of(employeeId))).thenReturn(Map.of(employeeId, "Mira Miller"));

        BoardView board = service.getBoard(tenant, workflowId);

        WorkItemView result = board.stages().getFirst().items().getFirst();
        assertThat(result.ownerUserId()).isEqualTo(employeeId);
        assertThat(result.ownerDisplayName()).isEqualTo("Mira Miller");
        verify(assignments).findOwnersByFirmIdAndWorkItemIdIn(tenant.firmId(), List.of(itemId));
        verify(employees).displayNames(tenant.firmId(), List.of(employeeId));
    }

    @Test
    void assignsAReviewerFromTheSelectedFirmAndRecordsSafeAuditEvent() {
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        WorkItem item = item(itemId, workflowId, UUID.randomUUID(), "1000");
        when(items.findByIdAndFirmIdAndWorkflowId(itemId, tenant.firmId(), workflowId)).thenReturn(Optional.of(item));
        when(membershipAccess.belongsToFirm(tenant.firmId(), reviewerId)).thenReturn(true);
        when(assignments.findRolesByFirmIdAndWorkItemIdIn(tenant.firmId(), List.of(itemId))).thenReturn(List.of(
                new WorkItemRoleAssignmentView(itemId, reviewerId, AssignmentRole.REVIEWER)));
        when(employees.displayNames(org.mockito.ArgumentMatchers.eq(tenant.firmId()), org.mockito.ArgumentMatchers.anyCollection()))
                .thenReturn(Map.of(reviewerId, "Robin Reviewer"));

        WorkItemView result = service.assignReviewer(tenant, workflowId, itemId, new AssignWorkItemRoleRequest(reviewerId));

        assertThat(result.reviewerUserId()).isEqualTo(reviewerId);
        assertThat(result.reviewerDisplayName()).isEqualTo("Robin Reviewer");
        verify(activity).recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.reviewer-assigned", "work-item", itemId, Map.of());
    }

    @Test
    void rejectsCrossClientDocumentRequestBeforeCreatingLink() {
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID otherClientId = UUID.randomUUID();
        WorkItem item = item(itemId, workflowId, UUID.randomUUID(), "1000");
        when(items.findByIdAndFirmIdAndWorkflowId(itemId, tenant.firmId(), workflowId)).thenReturn(Optional.of(item));
        when(documentRequests.find(tenant.firmId(), requestId)).thenReturn(Optional.of(
                new DocumentRequestSummary(requestId, otherClientId, "Bank statement", null, "REQUESTED", null)));

        assertThatThrownBy(() -> service.linkDocumentRequest(tenant, workflowId, itemId, requestId))
                .isInstanceOf(WorkNotFoundException.class);
        verify(activity, never()).recordRestUserAction(any(), any(), org.mockito.ArgumentMatchers.eq("work-item.document-request-linked"), any(), any(), any());
    }

    private WorkItem item(UUID id, UUID workflowId, UUID stageId, String rank) {
        return new WorkItem(id, tenant.firmId(), UUID.randomUUID(), workflowId, stageId, "Item", "", null,
                WorkPriority.NORMAL, new BigDecimal(rank), "FB-" + id, now);
    }

    private void mockFirmSlugLock() {
        when(firms.lockExisting(tenant.firmId())).thenReturn(true);
    }
}
