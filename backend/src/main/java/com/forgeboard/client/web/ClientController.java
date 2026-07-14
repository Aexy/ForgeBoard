package com.forgeboard.client.web;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.client.application.ClientRequest;
import com.forgeboard.client.application.ClientImportResult;
import com.forgeboard.client.application.ClientService;
import com.forgeboard.client.application.ClientView;
import com.forgeboard.identity.SelectedTenant;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/clients")
public class ClientController {
    private final ClientService clients;

    public ClientController(ClientService clients) { this.clients = clients; }

    @GetMapping
    List<ClientView> list(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant) {
        return clients.list(tenant);
    }

    @GetMapping("/{clientId}")
    ClientView get(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID clientId) {
        return clients.get(tenant, clientId);
    }

    @PostMapping
    ResponseEntity<ClientView> create(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @Valid @RequestBody ClientRequest request) {
        ClientView created = clients.create(tenant, request);
        return ResponseEntity.created(URI.create("/api/clients/" + created.id())).body(created);
    }

    @PostMapping(value = "/import", consumes = {"text/csv", "text/plain"})
    ClientImportResult importCsv(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @RequestBody String csv,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "true") boolean dryRun) {
        return clients.importCsv(tenant, csv, dryRun);
    }

    @PutMapping("/{clientId}")
    ClientView update(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID clientId, @Valid @RequestBody ClientRequest request) {
        return clients.update(tenant, clientId, request);
    }

    @PatchMapping("/{clientId}/archive")
    ClientView archive(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID clientId) {
        return clients.archive(tenant, clientId);
    }
}
