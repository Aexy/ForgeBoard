package com.forgeboard.work.web;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.application.BoardView;
import com.forgeboard.work.application.MoveWorkItemRequest;
import com.forgeboard.work.application.WorkItemRequest;
import com.forgeboard.work.application.WorkItemView;
import com.forgeboard.work.application.WorkflowRequest;
import com.forgeboard.work.application.WorkflowService;
import com.forgeboard.work.application.AssignWorkItemRequest;
import com.forgeboard.work.application.AssignWorkItemRoleRequest;
import com.forgeboard.work.application.WorkItemDetailView;
import com.forgeboard.work.application.WorkflowSummary;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {
    private final WorkflowService workflows;
    public WorkflowController(WorkflowService workflows) { this.workflows = workflows; }

    @GetMapping
    List<WorkflowSummary> list(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant) {
        return workflows.list(tenant);
    }

    @PostMapping
    ResponseEntity<BoardView> create(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @Valid @RequestBody WorkflowRequest request) {
        BoardView created = workflows.createWorkflow(tenant, request);
        return ResponseEntity.created(URI.create("/api/workflows/" + created.id())).body(created);
    }

    @GetMapping("/{workflowId}")
    BoardView board(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID workflowId) {
        return workflows.getBoard(tenant, workflowId);
    }

    @PostMapping("/{workflowId}/items")
    ResponseEntity<WorkItemView> createItem(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID workflowId, @Valid @RequestBody WorkItemRequest request) {
        WorkItemView created = workflows.createItem(tenant, workflowId, request);
        return ResponseEntity.created(URI.create("/api/workflows/" + workflowId + "/items/" + created.id())).body(created);
    }

    @PatchMapping("/{workflowId}/items/{itemId}/position")
    WorkItemView moveItem(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID workflowId, @PathVariable UUID itemId,
            @Valid @RequestBody MoveWorkItemRequest request) {
        return workflows.moveItem(tenant, workflowId, itemId, request);
    }

    @PutMapping("/{workflowId}/items/{itemId}/owner")
    WorkItemView assign(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID workflowId, @PathVariable UUID itemId, @Valid @RequestBody AssignWorkItemRequest request) {
        return workflows.assign(tenant, workflowId, itemId, request);
    }

    @GetMapping("/{workflowId}/items/{itemId}")
    WorkItemDetailView itemDetail(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID workflowId, @PathVariable UUID itemId) {
        return workflows.getItemDetail(tenant, workflowId, itemId);
    }

    @PutMapping("/{workflowId}/items/{itemId}/reviewer")
    WorkItemView assignReviewer(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID workflowId, @PathVariable UUID itemId,
            @RequestBody AssignWorkItemRoleRequest request) {
        return workflows.assignReviewer(tenant, workflowId, itemId, request);
    }

    @PutMapping("/{workflowId}/items/{itemId}/document-requests/{requestId}")
    WorkItemDetailView linkDocumentRequest(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID workflowId, @PathVariable UUID itemId, @PathVariable UUID requestId) {
        return workflows.linkDocumentRequest(tenant, workflowId, itemId, requestId);
    }

    @DeleteMapping("/{workflowId}/items/{itemId}/document-requests/{requestId}")
    WorkItemDetailView unlinkDocumentRequest(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID workflowId, @PathVariable UUID itemId, @PathVariable UUID requestId) {
        return workflows.unlinkDocumentRequest(tenant, workflowId, itemId, requestId);
    }
}
