package com.forgeboard.work.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Locale;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

import com.forgeboard.client.ClientDirectory;
import com.forgeboard.document.DocumentRequestDirectory;
import com.forgeboard.document.DocumentRequestSummary;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.ActivityDirectory;
import com.forgeboard.identity.EmployeeDirectory;
import com.forgeboard.identity.FirmDirectory;
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
import com.forgeboard.work.persistence.WorkItemDocumentRequestRepository;
import com.forgeboard.work.persistence.SavedWorkflowViewRepository;
import com.forgeboard.work.domain.SavedWorkflowView;

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
    private final EmployeeDirectory employees;
    private final DocumentRequestDirectory documentRequests;
    private final WorkItemDocumentRequestRepository documentLinks;
    private final ActivityDirectory activityQueries;
    private final SavedWorkflowViewRepository savedViews;
    private final FirmDirectory firms;

    public WorkflowService(WorkflowRepository workflows, WorkflowStageRepository stages,
            WorkItemRepository items, ClientDirectory clients, ActivityRecorder activity, Clock clock) {
        this.workflows = workflows; this.stages = stages; this.items = items; this.clients = clients;
        this.activity = activity; this.clock = clock;
        this.membershipAccess = null; this.assignments = null; this.employees = null;
        this.documentRequests = null; this.documentLinks = null; this.activityQueries = null;
        this.savedViews = null;
        this.firms = null;
    }

    public WorkflowService(WorkflowRepository workflows, WorkflowStageRepository stages, WorkItemRepository items,
            ClientDirectory clients, ActivityRecorder activity, Clock clock, MembershipAccess membershipAccess,
            WorkItemAssignmentRepository assignments, EmployeeDirectory employees) {
        this.workflows = workflows; this.stages = stages; this.items = items; this.clients = clients; this.activity = activity;
        this.clock = clock; this.membershipAccess = membershipAccess; this.assignments = assignments; this.employees = employees;
        this.documentRequests = null; this.documentLinks = null; this.activityQueries = null;
        this.savedViews = null;
        this.firms = null;
    }

    public WorkflowService(WorkflowRepository workflows, WorkflowStageRepository stages, WorkItemRepository items,
            ClientDirectory clients, ActivityRecorder activity, Clock clock, MembershipAccess membershipAccess,
            WorkItemAssignmentRepository assignments, EmployeeDirectory employees, DocumentRequestDirectory documentRequests,
            WorkItemDocumentRequestRepository documentLinks, ActivityDirectory activityQueries) {
        this(workflows, stages, items, clients, activity, clock, membershipAccess, assignments, employees,
                documentRequests, documentLinks, activityQueries, null, null);
    }

    public WorkflowService(WorkflowRepository workflows, WorkflowStageRepository stages, WorkItemRepository items,
            ClientDirectory clients, ActivityRecorder activity, Clock clock, MembershipAccess membershipAccess,
            WorkItemAssignmentRepository assignments, EmployeeDirectory employees, DocumentRequestDirectory documentRequests,
            WorkItemDocumentRequestRepository documentLinks, ActivityDirectory activityQueries,
            SavedWorkflowViewRepository savedViews) {
        this(workflows, stages, items, clients, activity, clock, membershipAccess, assignments, employees,
                documentRequests, documentLinks, activityQueries, savedViews, null);
    }

    @Autowired
    public WorkflowService(WorkflowRepository workflows, WorkflowStageRepository stages, WorkItemRepository items,
            ClientDirectory clients, ActivityRecorder activity, Clock clock, MembershipAccess membershipAccess,
            WorkItemAssignmentRepository assignments, EmployeeDirectory employees, DocumentRequestDirectory documentRequests,
            WorkItemDocumentRequestRepository documentLinks, ActivityDirectory activityQueries,
            SavedWorkflowViewRepository savedViews, FirmDirectory firms) {
        this.workflows = workflows; this.stages = stages; this.items = items; this.clients = clients; this.activity = activity;
        this.clock = clock; this.membershipAccess = membershipAccess; this.assignments = assignments; this.employees = employees;
        this.documentRequests = documentRequests; this.documentLinks = documentLinks; this.activityQueries = activityQueries;
        this.savedViews = savedViews; this.firms = firms;
    }

    @Transactional(readOnly = true)
    public List<WorkflowSummary> list(SelectedTenant tenant) {
        return workflows.findAllByFirmIdOrderByNameAsc(tenant.firmId()).stream()
                .map(workflow -> new WorkflowSummary(workflow.id(), workflow.name(), workflow.workflowSlug())).toList();
    }

    @Transactional(readOnly = true)
    public List<WorkflowFilterView> listSavedViews(SelectedTenant tenant) {
        return savedViews.findAllByFirmIdOrderByNameAsc(tenant.firmId()).stream()
                .map(this::filterView).toList();
    }

    @Transactional
    public WorkflowFilterView createSavedView(SelectedTenant tenant, CreateWorkflowFilterRequest request) {
        membershipAccess.requireWorkflowViewManagement(tenant);
        String name = request.name().strip();
        if (name.isEmpty()) throw new IllegalArgumentException("View name must not be blank");
        if (request.clientId() != null && !clients.exists(tenant.firmId(), request.clientId()))
            throw new WorkNotFoundException("Client was not found in the selected firm");
        if (request.ownerUserId() != null && !membershipAccess.belongsToFirm(tenant.firmId(), request.ownerUserId()))
            throw new WorkNotFoundException("Employee was not found in the selected firm");
        SavedWorkflowView saved = savedViews.save(new SavedWorkflowView(UUID.randomUUID(), tenant.firmId(), name,
                request.clientId(), request.ownerUserId(), request.dueState(), request.priority(), request.unassigned(),
                tenant.userId(), clock.instant()));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "workflow-view.created", "workflow-view",
                saved.id(), Map.of("name", saved.name()));
        return filterView(saved);
    }

    @Transactional
    public void deleteSavedView(SelectedTenant tenant, UUID viewId) {
        membershipAccess.requireWorkflowViewManagement(tenant);
        SavedWorkflowView saved = savedViews.findByIdAndFirmId(viewId, tenant.firmId())
                .orElseThrow(() -> new WorkNotFoundException("Saved workflow view was not found in the selected firm"));
        savedViews.deleteByIdAndFirmId(saved.id(), tenant.firmId());
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "workflow-view.deleted", "workflow-view",
                saved.id(), Map.of("name", saved.name()));
    }

    @Transactional
    public BoardView createWorkflow(SelectedTenant tenant, WorkflowRequest request) {
        requireWrite(tenant);
        var now = clock.instant();
        String name = request.name().strip();
        lockFirmForWorkflowSlugAllocation(tenant.firmId());
        WorkflowBoard workflow = workflows.save(new WorkflowBoard(UUID.randomUUID(), tenant.firmId(), name,
                nextWorkflowSlug(tenant.firmId(), name), now));
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

    @Transactional(readOnly = true)
    public BoardView getBoard(SelectedTenant tenant, String workflowSlug) {
        WorkflowBoard workflow = requireWorkflow(tenant, workflowSlug);
        return getBoard(tenant, workflow.id());
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
                request.dueDate(), request.priority(), rank, items.allocateTaskReference(), clock.instant()));
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

    @Transactional(readOnly = true)
    public WorkItemDetailView getItemDetail(SelectedTenant tenant, UUID workflowId, UUID itemId) {
        WorkItem item = requireItem(tenant, workflowId, itemId);
        String clientDisplayName = clients.displayName(tenant.firmId(), item.clientId())
                .orElseThrow(() -> new WorkNotFoundException("Client was not found in the selected firm"));
        List<DocumentRequestSummaryView> linkedRequests = documentLinks.findAllByFirmIdAndWorkItemId(tenant.firmId(), item.id())
                .stream().map(link -> documentRequests.find(tenant.firmId(), link.documentRequestId())
                        .orElseThrow(() -> new WorkNotFoundException("Document request was not found in the selected firm")))
                .map(this::documentView).toList();
        return new WorkItemDetailView(viewWithRoles(item), clientDisplayName, linkedRequests,
                activityQueries.recent(tenant, "work-item", item.id()));
    }

    @Transactional(readOnly = true)
    public WorkItemDetailView getItemDetail(SelectedTenant tenant, String workflowSlug, String taskReference) {
        WorkflowBoard workflow = requireWorkflow(tenant, workflowSlug);
        WorkItem item = items.findByFirmIdAndWorkflowIdAndTaskReference(tenant.firmId(), workflow.id(), taskReference)
                .orElseThrow(() -> new WorkNotFoundException("Work item was not found in the selected workflow"));
        return getItemDetail(tenant, workflow.id(), item.id());
    }

    @Transactional
    public WorkItemView assignReviewer(SelectedTenant tenant, UUID workflowId, UUID itemId, AssignWorkItemRoleRequest request) {
        membershipAccess.requireAssignmentManagement(tenant);
        WorkItem item = requireItem(tenant, workflowId, itemId);
        assignments.deleteByFirmIdAndWorkItemIdAndAssignmentRole(tenant.firmId(), item.id(), AssignmentRole.REVIEWER);
        if (request.userId() == null) {
            activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.reviewer-cleared", "work-item", item.id(), Map.of());
            return viewWithRoles(item);
        }
        if (!membershipAccess.belongsToFirm(tenant.firmId(), request.userId()))
            throw new WorkNotFoundException("Employee was not found in the selected firm");
        assignments.save(new com.forgeboard.work.domain.WorkItemAssignment(UUID.randomUUID(), tenant.firmId(), item.id(),
                request.userId(), AssignmentRole.REVIEWER, clock.instant(), tenant.userId()));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.reviewer-assigned", "work-item", item.id(), Map.of());
        return viewWithRoles(item);
    }

    @Transactional
    public WorkItemDetailView linkDocumentRequest(SelectedTenant tenant, UUID workflowId, UUID itemId, UUID requestId) {
        membershipAccess.requireAssignmentManagement(tenant);
        WorkItem item = requireItem(tenant, workflowId, itemId);
        DocumentRequestSummary request = documentRequests.find(tenant.firmId(), requestId)
                .orElseThrow(() -> new WorkNotFoundException("Document request was not found in the selected firm"));
        if (!item.clientId().equals(request.clientId()))
            throw new WorkNotFoundException("Document request was not found for this work item's client");
        if (documentLinks.existsByFirmIdAndDocumentRequestId(tenant.firmId(), requestId))
            throw new IllegalArgumentException("Document request is already linked to a work item");
        documentLinks.save(new com.forgeboard.work.domain.WorkItemDocumentRequest(tenant.firmId(), item.id(), requestId));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.document-request-linked", "work-item", item.id(), Map.of());
        return getItemDetail(tenant, workflowId, itemId);
    }

    @Transactional
    public WorkItemDetailView unlinkDocumentRequest(SelectedTenant tenant, UUID workflowId, UUID itemId, UUID requestId) {
        membershipAccess.requireAssignmentManagement(tenant);
        requireItem(tenant, workflowId, itemId);
        if (documentLinks.deleteByFirmIdAndWorkItemIdAndDocumentRequestId(tenant.firmId(), itemId, requestId) == 0)
            throw new WorkNotFoundException("Document request link was not found in the selected work item");
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.document-request-unlinked", "work-item", itemId, Map.of());
        return getItemDetail(tenant, workflowId, itemId);
    }

    private WorkItem neighbor(SelectedTenant tenant, UUID workflowId, UUID stageId, UUID movingItemId, UUID neighborId) {
        if (neighborId == null) return null;
        if (neighborId.equals(movingItemId)) throw new IllegalArgumentException("A work item cannot neighbor itself");
        WorkItem neighbor = requireItem(tenant, workflowId, neighborId);
        if (!neighbor.stageId().equals(stageId)) throw new IllegalArgumentException("Move neighbors must be in the target stage");
        return neighbor;
    }

    private WorkflowFilterView filterView(SavedWorkflowView saved) {
        return new WorkflowFilterView(saved.id(), saved.name(), saved.clientId(), saved.ownerUserId(),
                saved.dueState(), saved.priority(), saved.unassigned());
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

    private WorkflowBoard requireWorkflow(SelectedTenant tenant, String workflowSlug) {
        return workflows.findByFirmIdAndWorkflowSlug(tenant.firmId(), workflowSlug)
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
        Map<UUID, Map<AssignmentRole, UUID>> roles = roles(workflow.firmId(), itemList);
        Map<UUID, String> names = employees == null || roles.isEmpty() ? Map.of()
                : employees.displayNames(workflow.firmId(), roles.values().stream().flatMap(role -> role.values().stream()).distinct().toList());
        List<StageView> stageViews = stageList.stream().map(stage -> new StageView(stage.id(), stage.name(), stage.attention(),
                stage.position(), itemList.stream().filter(item -> item.stageId().equals(stage.id()))
                        .map(item -> view(item, roles.getOrDefault(item.id(), Map.of()), names)).toList())).toList();
        return new BoardView(workflow.id(), workflow.name(), workflow.workflowSlug(), stageViews);
    }

    private WorkItemView view(WorkItem item) {
        return view(item, null);
    }
    private WorkItemView view(WorkItem item, UUID ownerUserId) {
        return view(item, ownerUserId, null);
    }
    private WorkItemView view(WorkItem item, UUID ownerUserId, String ownerDisplayName) {
        return new WorkItemView(item.id(), item.taskReference(), item.clientId(), item.stageId(), item.title(), item.description(),
                item.dueDate(), item.priority(), item.rank(), item.version(), ownerUserId, ownerDisplayName, null, null);
    }
    private WorkItemView view(WorkItem item, Map<AssignmentRole, UUID> roles, Map<UUID, String> names) {
        UUID owner = roles.get(AssignmentRole.OWNER);
        UUID reviewer = roles.get(AssignmentRole.REVIEWER);
        return new WorkItemView(item.id(), item.taskReference(), item.clientId(), item.stageId(), item.title(), item.description(),
                item.dueDate(), item.priority(), item.rank(), item.version(), owner,
                owner == null ? null : names.get(owner), reviewer, reviewer == null ? null : names.get(reviewer));
    }

    private Map<UUID, Map<AssignmentRole, UUID>> roles(UUID firmId, List<WorkItem> itemList) {
        if (assignments == null || itemList.isEmpty()) return Map.of();
        List<WorkItemRoleAssignmentView> found = assignments.findRolesByFirmIdAndWorkItemIdIn(firmId, itemList.stream().map(WorkItem::id).toList());
        if (found == null || found.isEmpty()) {
            return assignments.findOwnersByFirmIdAndWorkItemIdIn(firmId, itemList.stream().map(WorkItem::id).toList()).stream()
                    .collect(java.util.stream.Collectors.groupingBy(OwnerAssignmentView::workItemId,
                            java.util.stream.Collectors.toMap(owner -> AssignmentRole.OWNER, OwnerAssignmentView::userId)));
        }
        return found.stream()
                .collect(java.util.stream.Collectors.groupingBy(WorkItemRoleAssignmentView::workItemId,
                        java.util.stream.Collectors.toMap(WorkItemRoleAssignmentView::role, WorkItemRoleAssignmentView::userId)));
    }

    private WorkItemView viewWithRoles(WorkItem item) {
        Map<UUID, Map<AssignmentRole, UUID>> roles = roles(item.firmId(), List.of(item));
        Map<AssignmentRole, UUID> itemRoles = roles.getOrDefault(item.id(), Map.of());
        Map<UUID, String> names = employees.displayNames(item.firmId(), itemRoles.values());
        return view(item, itemRoles, names);
    }

    private DocumentRequestSummaryView documentView(DocumentRequestSummary request) {
        return new DocumentRequestSummaryView(request.id(), request.label(), request.dueDate(), request.status(), request.receivedAt());
    }

    private String normalizeDescription(String description) { return description == null ? "" : description.strip(); }
    private String nextWorkflowSlug(UUID firmId, String name) {
        String base = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (base.isBlank()) base = "workflow";
        String candidate = base;
        int suffix = 2;
        while (workflows.existsByFirmIdAndWorkflowSlug(firmId, candidate)) candidate = base + "-" + suffix++;
        return candidate;
    }
    private void lockFirmForWorkflowSlugAllocation(UUID firmId) {
        if (firms == null) return;
        if (!firms.lockExisting(firmId)) {
            throw new WorkNotFoundException("Firm was not found for workflow creation");
        }
    }
    private void requireWrite(SelectedTenant tenant) {
        if (!tenant.canWrite()) throw new AccessDeniedException("Read-only members cannot change workflows");
    }
}
