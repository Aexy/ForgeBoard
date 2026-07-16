package com.forgeboard.work.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

import com.forgeboard.client.ClientDirectory;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.MembershipAccess;
import com.forgeboard.work.domain.AssignmentRole;
import com.forgeboard.work.domain.WorkItem;
import com.forgeboard.work.domain.WorkflowBoard;
import com.forgeboard.work.domain.WorkflowStage;
import com.forgeboard.work.persistence.WorkItemRepository;
import com.forgeboard.work.persistence.WorkflowRepository;
import com.forgeboard.work.persistence.WorkflowStageRepository;
import com.forgeboard.work.persistence.WorkItemAssignmentRepository;

@Service
public class WorkflowService {
    private static final BigDecimal RANK_STEP = new BigDecimal("1000.0000000000");
    private final WorkflowRepository workflows;
    private final WorkflowStageRepository stages;
    private final WorkItemRepository items;
    private final ClientDirectory clients;
    private final ActivityRecorder activity;
    private final Clock clock;
    private final MembershipAccess membershipAccess;
    private final WorkItemAssignmentRepository assignments;

    public WorkflowService(WorkflowRepository workflows, WorkflowStageRepository stages,
            WorkItemRepository items, ClientDirectory clients, ActivityRecorder activity, Clock clock) {
        this.workflows = workflows; this.stages = stages; this.items = items; this.clients = clients;
        this.activity = activity; this.clock = clock;
        this.membershipAccess = null; this.assignments = null;
    }

    @Autowired
    public WorkflowService(WorkflowRepository workflows, WorkflowStageRepository stages, WorkItemRepository items,
            ClientDirectory clients, ActivityRecorder activity, Clock clock, MembershipAccess membershipAccess,
            WorkItemAssignmentRepository assignments) {
        this.workflows = workflows; this.stages = stages; this.items = items; this.clients = clients; this.activity = activity;
        this.clock = clock; this.membershipAccess = membershipAccess; this.assignments = assignments;
    }

    @Transactional(readOnly = true)
    public List<WorkflowSummary> list(SelectedTenant tenant) {
        return workflows.findAllByFirmIdOrderByNameAsc(tenant.firmId()).stream()
                .map(workflow -> new WorkflowSummary(workflow.id(), workflow.name())).toList();
    }

    @Transactional
    public BoardView createWorkflow(SelectedTenant tenant, WorkflowRequest request) {
        requireWrite(tenant);
        var now = clock.instant();
        WorkflowBoard workflow = workflows.save(new WorkflowBoard(UUID.randomUUID(), tenant.firmId(),
                request.name().strip(), now));
        List<WorkflowStage> createdStages = new ArrayList<>();
        for (int position = 0; position < request.stages().size(); position++) {
            createdStages.add(stages.save(new WorkflowStage(UUID.randomUUID(), tenant.firmId(), workflow.id(),
                    request.stages().get(position).name().strip(), request.stages().get(position).attention(), position, now)));
        }
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "workflow.created", "workflow",
                workflow.id(), Map.of("name", workflow.name(), "stageCount", createdStages.size()));
        return board(workflow, createdStages, List.of());
    }

    @Transactional(readOnly = true)
    public BoardView getBoard(SelectedTenant tenant, UUID workflowId) {
        WorkflowBoard workflow = requireWorkflow(tenant, workflowId);
        List<WorkItem> boardItems = items.findAllByFirmIdAndWorkflowIdOrderByStageIdAscRankAscIdAsc(tenant.firmId(), workflowId);
        return board(workflow, stages.findAllByFirmIdAndWorkflowIdOrderByPositionAsc(tenant.firmId(), workflowId), boardItems);
    }

    @Transactional
    public WorkItemView createItem(SelectedTenant tenant, UUID workflowId, WorkItemRequest request) {
        requireWrite(tenant);
        requireWorkflow(tenant, workflowId);
        lockStage(tenant.firmId(), workflowId, request.stageId());
        if (!clients.exists(tenant.firmId(), request.clientId()))
            throw new WorkNotFoundException("Client was not found in the selected firm");
        BigDecimal rank = nextRank(tenant.firmId(), workflowId, request.stageId());
        WorkItem item = items.save(new WorkItem(UUID.randomUUID(), tenant.firmId(), request.clientId(), workflowId,
                request.stageId(), request.title().strip(), normalizeDescription(request.description()),
                request.dueDate(), request.priority(), rank, clock.instant()));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.created", "work-item",
                item.id(), Map.of("title", item.title(), "workflowId", workflowId.toString()));
        return view(item);
    }

    @Transactional
    public WorkItemView moveItem(SelectedTenant tenant, UUID workflowId, UUID itemId, MoveWorkItemRequest request) {
        requireWrite(tenant);
        requireWorkflow(tenant, workflowId);
        lockStage(tenant.firmId(), workflowId, request.targetStageId());
        WorkItem item = requireItem(tenant, workflowId, itemId);
        if (!Long.valueOf(item.version()).equals(request.expectedVersion())) throw new WorkItemConflictException();
        WorkItem before = neighbor(tenant, workflowId, request.targetStageId(), itemId, request.beforeItemId());
        WorkItem after = neighbor(tenant, workflowId, request.targetStageId(), itemId, request.afterItemId());
        BigDecimal rank = rankBetween(tenant.firmId(), workflowId, request.targetStageId(), before, after);
        UUID previousStage = item.stageId();
        item.move(request.targetStageId(), rank, clock.instant());
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.moved", "work-item", item.id(),
                Map.of("fromStageId", previousStage.toString(), "toStageId", request.targetStageId().toString()));
        return view(item);
    }

    @Transactional
    public WorkItemView assign(SelectedTenant tenant, UUID workflowId, UUID itemId, AssignWorkItemRequest request) {
        membershipAccess.requireAssignmentManagement(tenant);
        WorkItem item = requireItem(tenant, workflowId, itemId);
        assignments.deleteByFirmIdAndWorkItemIdAndAssignmentRole(tenant.firmId(), item.id(), AssignmentRole.OWNER);
        if (request.ownerUserId() == null) {
            activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.unassigned", "work-item", item.id(),
                    Map.of());
            return view(item, null);
        }
        if (!membershipAccess.belongsToFirm(tenant.firmId(), request.ownerUserId()))
            throw new WorkNotFoundException("Employee was not found in the selected firm");
        assignments.save(new com.forgeboard.work.domain.WorkItemAssignment(UUID.randomUUID(), tenant.firmId(), item.id(),
                request.ownerUserId(), AssignmentRole.OWNER, clock.instant(), tenant.userId()));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.assigned", "work-item", item.id(),
                Map.of("ownerUserId", request.ownerUserId().toString()));
        return view(item, request.ownerUserId());
    }

    private WorkItem neighbor(SelectedTenant tenant, UUID workflowId, UUID stageId, UUID movingItemId, UUID neighborId) {
        if (neighborId == null) return null;
        if (neighborId.equals(movingItemId)) throw new IllegalArgumentException("A work item cannot neighbor itself");
        WorkItem neighbor = requireItem(tenant, workflowId, neighborId);
        if (!neighbor.stageId().equals(stageId)) throw new IllegalArgumentException("Move neighbors must be in the target stage");
        return neighbor;
    }

    private BigDecimal rankBetween(UUID firmId, UUID workflowId, UUID stageId, WorkItem before, WorkItem after) {
        if (before != null && after != null) {
            if (before.rank().compareTo(after.rank()) >= 0) throw new IllegalArgumentException("Move neighbors are out of order");
            return before.rank().add(after.rank()).divide(BigDecimal.valueOf(2), 10, RoundingMode.HALF_UP);
        }
        if (before != null) return before.rank().add(RANK_STEP);
        if (after != null) return after.rank().subtract(RANK_STEP);
        return nextRank(firmId, workflowId, stageId);
    }

    private BigDecimal nextRank(UUID firmId, UUID workflowId, UUID stageId) {
        return items.maximumRank(firmId, workflowId, stageId).orElse(BigDecimal.ZERO).add(RANK_STEP);
    }

    private WorkflowBoard requireWorkflow(SelectedTenant tenant, UUID workflowId) {
        return workflows.findByIdAndFirmId(workflowId, tenant.firmId())
                .orElseThrow(() -> new WorkNotFoundException("Workflow was not found in the selected firm"));
    }

    private void lockStage(UUID firmId, UUID workflowId, UUID stageId) {
        stages.findByIdAndFirmIdAndWorkflowIdForUpdate(stageId, firmId, workflowId)
                .orElseThrow(() -> new WorkNotFoundException("Stage was not found in the selected workflow"));
    }

    private WorkItem requireItem(SelectedTenant tenant, UUID workflowId, UUID itemId) {
        return items.findByIdAndFirmIdAndWorkflowId(itemId, tenant.firmId(), workflowId)
                .orElseThrow(() -> new WorkNotFoundException("Work item was not found in the selected workflow"));
    }

    private BoardView board(WorkflowBoard workflow, List<WorkflowStage> stageList, List<WorkItem> itemList) {
        Map<UUID, UUID> owners = assignments == null || itemList.isEmpty() ? Map.of() : assignments
                .findOwnersByFirmIdAndWorkItemIdIn(workflow.firmId(), itemList.stream().map(WorkItem::id).toList()).stream()
                .collect(java.util.stream.Collectors.toMap(OwnerAssignmentView::workItemId, OwnerAssignmentView::userId));
        List<StageView> stageViews = stageList.stream().map(stage -> new StageView(stage.id(), stage.name(), stage.attention(),
                stage.position(), itemList.stream().filter(item -> item.stageId().equals(stage.id()))
                        .map(item -> view(item, owners.get(item.id()))).toList())).toList();
        return new BoardView(workflow.id(), workflow.name(), stageViews);
    }

    private WorkItemView view(WorkItem item) {
        return view(item, null);
    }
    private WorkItemView view(WorkItem item, UUID ownerUserId) {
        return new WorkItemView(item.id(), item.clientId(), item.stageId(), item.title(), item.description(),
                item.dueDate(), item.priority(), item.rank(), item.version(), ownerUserId);
    }

    private String normalizeDescription(String description) { return description == null ? "" : description.strip(); }
    private void requireWrite(SelectedTenant tenant) {
        if (!tenant.canWrite()) throw new AccessDeniedException("Read-only members cannot change workflows");
    }
}
