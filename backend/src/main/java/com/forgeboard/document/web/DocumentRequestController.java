package com.forgeboard.document.web;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.document.application.DocumentRequestInput;
import com.forgeboard.document.application.DocumentRequestService;
import com.forgeboard.document.application.DocumentRequestView;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.security.TenantSelectionFilter;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/document-requests")
public class DocumentRequestController {
    private final DocumentRequestService requests;

    public DocumentRequestController(DocumentRequestService requests) {
        this.requests = requests;
    }

    @GetMapping
    List<DocumentRequestView> list(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant) {
        return requests.list(tenant);
    }

    @PostMapping
    ResponseEntity<DocumentRequestView> create(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @Valid @RequestBody DocumentRequestInput input) {
        DocumentRequestView created = requests.create(tenant, input);
        return ResponseEntity.created(URI.create("/api/document-requests/" + created.id())).body(created);
    }

    @PatchMapping("/{id}/received")
    DocumentRequestView receive(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID id) {
        return requests.receive(tenant, id);
    }
}
