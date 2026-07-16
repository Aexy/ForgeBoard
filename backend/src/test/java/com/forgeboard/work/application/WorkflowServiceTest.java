package com.forgeboard.work.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.forgeboard.client.ClientDirectory;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.EmployeeDirectory;
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
import com.forgeboard.work.persistence.WorkflowRepository;
import com.forgeboard.work.persistence.WorkflowStageRepository;

@ExtendWith(MockitoExtension.class)
class WorkflowServiceTest {
    @Mock WorkflowRepository workflows;
    @Mock WorkflowStageRepository stages;
    @Mock WorkItemRepository items;
    @Mock ClientDirectory clients;
    @Mock ActivityRecorder activity;
    @Mock MembershipAccess membershipAccess;
    @Mock WorkItemAssignmentRepository assignments;
    @Mock EmployeeDirectory employees;
    WorkflowService service;
    SelectedTenant tenant;
    Instant now;

    @BeforeEach
    void setUp() {
        now = Instant.parse("2026-07-12T22:00:00Z");
        tenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "owner@example.com", MembershipRole.OWNER);
        service = new WorkflowService(workflows, stages, items, clients, activity,
                Clock.fixed(now, ZoneOffset.UTC), membershipAccess, assignments, employees);
    }

    @Test
    void createsAnOrderedWorkflowAndAuditEvent() {
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
    void createsAWorkItemOnlyWithTenantScopedRelations() {
        UUID workflowId = UUID.randomUUID();
        UUID stageId = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();
        when(workflows.findByIdAndFirmId(workflowId, tenant.firmId())).thenReturn(Optional.of(
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", now)));
        when(stages.findByIdAndFirmIdAndWorkflowIdForUpdate(stageId, tenant.firmId(), workflowId)).thenReturn(Optional.of(
                new WorkflowStage(stageId, tenant.firmId(), workflowId, "Waiting", StageAttention.NONE, 0, now)));
        when(clients.exists(tenant.firmId(), clientId)).thenReturn(true);
        when(items.maximumRank(tenant.firmId(), workflowId, stageId)).thenReturn(Optional.empty());
        when(items.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemView created = service.createItem(tenant, workflowId,
                new WorkItemRequest(clientId, stageId, "June bookkeeping", "", null, WorkPriority.NORMAL));

        assertThat(created.rank()).isEqualByComparingTo("1000");
        assertThat(created.clientId()).isEqualTo(clientId);
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
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", now)));
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
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", now)));
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
                new WorkflowBoard(workflowId, tenant.firmId(), "Monthly", now)));
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

    private WorkItem item(UUID id, UUID workflowId, UUID stageId, String rank) {
        return new WorkItem(id, tenant.firmId(), UUID.randomUUID(), workflowId, stageId, "Item", "", null,
                WorkPriority.NORMAL, new BigDecimal(rank), now);
    }
}
