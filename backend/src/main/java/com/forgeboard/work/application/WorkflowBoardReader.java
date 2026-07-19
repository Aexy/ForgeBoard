package com.forgeboard.work.application;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.client.ClientDirectory;
import com.forgeboard.document.DocumentRequestDirectory;
import com.forgeboard.document.DocumentRequestSummary;
import com.forgeboard.identity.ActivityDirectory;
import com.forgeboard.identity.EmployeeDirectory;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.domain.AssignmentRole;
import com.forgeboard.work.domain.WorkItem;
import com.forgeboard.work.domain.WorkflowBoard;
import com.forgeboard.work.domain.WorkflowStage;
import com.forgeboard.work.persistence.WorkItemAssignmentRepository;
import com.forgeboard.work.persistence.WorkItemDocumentRequestRepository;
import com.forgeboard.work.persistence.WorkItemRepository;
import com.forgeboard.work.persistence.WorkflowRepository;
import com.forgeboard.work.persistence.WorkflowStageRepository;

@Component
class WorkflowBoardReader {
    private final WorkflowRepository workflows;
    private final WorkflowStageRepository stages;
    private final WorkItemRepository items;
    private final ClientDirectory clients;
    private final WorkItemAssignmentRepository assignments;
    private final EmployeeDirectory employees;
    private final DocumentRequestDirectory documentRequests;
    private final WorkItemDocumentRequestRepository documentLinks;
    private final ActivityDirectory activityQueries;

    WorkflowBoardReader(WorkflowRepository workflows, WorkflowStageRepository stages, WorkItemRepository items,
            ClientDirectory clients, WorkItemAssignmentRepository assignments, EmployeeDirectory employees,
            DocumentRequestDirectory documentRequests, WorkItemDocumentRequestRepository documentLinks,
            ActivityDirectory activityQueries) {
        this.workflows = workflows;
        this.stages = stages;
        this.items = items;
        this.clients = clients;
        this.assignments = assignments;
        this.employees = employees;
        this.documentRequests = documentRequests;
        this.documentLinks = documentLinks;
        this.activityQueries = activityQueries;
    }

    @Transactional(readOnly = true)
    BoardView getBoard(SelectedTenant tenant, UUID workflowId) {
        WorkflowBoard workflow = requireWorkflow(tenant, workflowId);
        List<WorkItem> boardItems = items.findAllByFirmIdAndWorkflowIdOrderByStageIdAscRankAscIdAsc(tenant.firmId(), workflowId);
        return board(workflow, stages.findAllByFirmIdAndWorkflowIdOrderByPositionAsc(tenant.firmId(), workflowId), boardItems);
    }

    @Transactional(readOnly = true)
    BoardView getBoard(SelectedTenant tenant, String workflowSlug) {
        WorkflowBoard workflow = requireWorkflow(tenant, workflowSlug);
        return getBoard(tenant, workflow.id());
    }

    @Transactional(readOnly = true)
    WorkItemDetailView getItemDetail(SelectedTenant tenant, UUID workflowId, UUID itemId) {
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
    WorkItemDetailView getItemDetail(SelectedTenant tenant, String workflowSlug, String taskReference) {
        WorkflowBoard workflow = requireWorkflow(tenant, workflowSlug);
        WorkItem item = items.findByFirmIdAndWorkflowIdAndTaskReference(tenant.firmId(), workflow.id(), taskReference)
                .orElseThrow(() -> new WorkNotFoundException("Work item was not found in the selected workflow"));
        return getItemDetail(tenant, workflow.id(), item.id());
    }

    BoardView board(WorkflowBoard workflow, List<WorkflowStage> stageList, List<WorkItem> itemList) {
        Map<UUID, Map<AssignmentRole, UUID>> roles = roles(workflow.firmId(), itemList);
        Map<UUID, String> names = roles.isEmpty() ? Map.of()
                : employees.displayNames(workflow.firmId(), roles.values().stream().flatMap(role -> role.values().stream()).distinct().toList());
        List<StageView> stageViews = stageList.stream().map(stage -> new StageView(stage.id(), stage.name(), stage.attention(),
                stage.position(), itemList.stream().filter(item -> item.stageId().equals(stage.id()))
                        .map(item -> view(item, roles.getOrDefault(item.id(), Map.of()), names)).toList())).toList();
        return new BoardView(workflow.id(), workflow.name(), workflow.workflowSlug(), stageViews);
    }

    WorkItemView view(WorkItem item) {
        return view(item, null);
    }

    WorkItemView view(WorkItem item, UUID ownerUserId) {
        return view(item, ownerUserId, null);
    }

    WorkItemView view(WorkItem item, UUID ownerUserId, String ownerDisplayName) {
        return new WorkItemView(item.id(), item.taskReference(), item.clientId(), item.stageId(), item.title(), item.description(),
                item.dueDate(), item.priority(), item.rank(), item.version(), ownerUserId, ownerDisplayName, null, null);
    }

    WorkItemView viewWithRoles(WorkItem item) {
        Map<UUID, Map<AssignmentRole, UUID>> roles = roles(item.firmId(), List.of(item));
        Map<AssignmentRole, UUID> itemRoles = roles.getOrDefault(item.id(), Map.of());
        Map<UUID, String> names = employees.displayNames(item.firmId(), itemRoles.values());
        return view(item, itemRoles, names);
    }

    private WorkflowBoard requireWorkflow(SelectedTenant tenant, UUID workflowId) {
        return workflows.findByIdAndFirmId(workflowId, tenant.firmId())
                .orElseThrow(() -> new WorkNotFoundException("Workflow was not found in the selected firm"));
    }

    private WorkflowBoard requireWorkflow(SelectedTenant tenant, String workflowSlug) {
        return workflows.findByFirmIdAndWorkflowSlug(tenant.firmId(), workflowSlug)
                .orElseThrow(() -> new WorkNotFoundException("Workflow was not found in the selected firm"));
    }

    private WorkItem requireItem(SelectedTenant tenant, UUID workflowId, UUID itemId) {
        return items.findByIdAndFirmIdAndWorkflowId(itemId, tenant.firmId(), workflowId)
                .orElseThrow(() -> new WorkNotFoundException("Work item was not found in the selected workflow"));
    }

    private WorkItemView view(WorkItem item, Map<AssignmentRole, UUID> roles, Map<UUID, String> names) {
        UUID owner = roles.get(AssignmentRole.OWNER);
        UUID reviewer = roles.get(AssignmentRole.REVIEWER);
        return new WorkItemView(item.id(), item.taskReference(), item.clientId(), item.stageId(), item.title(), item.description(),
                item.dueDate(), item.priority(), item.rank(), item.version(), owner,
                owner == null ? null : names.get(owner), reviewer, reviewer == null ? null : names.get(reviewer));
    }

    private Map<UUID, Map<AssignmentRole, UUID>> roles(UUID firmId, List<WorkItem> itemList) {
        if (itemList.isEmpty()) return Map.of();
        List<WorkItemRoleAssignmentView> found = assignments.findRolesByFirmIdAndWorkItemIdIn(firmId, itemList.stream().map(WorkItem::id).toList());
        if (found == null || found.isEmpty()) {
            return assignments.findOwnersByFirmIdAndWorkItemIdIn(firmId, itemList.stream().map(WorkItem::id).toList()).stream()
                    .collect(java.util.stream.Collectors.groupingBy(OwnerAssignmentView::workItemId,
                            java.util.stream.Collectors.toMap(owner -> AssignmentRole.OWNER, OwnerAssignmentView::userId)));
        }
        return found.stream().collect(java.util.stream.Collectors.groupingBy(WorkItemRoleAssignmentView::workItemId,
                java.util.stream.Collectors.toMap(WorkItemRoleAssignmentView::role, WorkItemRoleAssignmentView::userId)));
    }

    private DocumentRequestSummaryView documentView(DocumentRequestSummary request) {
        return new DocumentRequestSummaryView(request.id(), request.label(), request.dueDate(), request.status(), request.receivedAt());
    }
}
