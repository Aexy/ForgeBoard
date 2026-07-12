package com.forgeboard.client.application;

import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.client.domain.ClientAccount;
import com.forgeboard.client.persistence.ClientRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;

@Service
public class ClientService {
    private final ClientRepository clients;
    private final ActivityRecorder activity;
    private final Clock clock;

    public ClientService(ClientRepository clients, ActivityRecorder activity, Clock clock) {
        this.clients = clients;
        this.activity = activity;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ClientView> list(SelectedTenant tenant) {
        return clients.findAllByFirmIdOrderByDisplayNameAsc(tenant.firmId()).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public ClientView get(SelectedTenant tenant, UUID clientId) { return view(requireClient(tenant, clientId)); }

    @Transactional
    public ClientView create(SelectedTenant tenant, ClientRequest request) {
        requireWrite(tenant);
        ClientAccount client = new ClientAccount(UUID.randomUUID(), tenant.firmId(), request.legalName().strip(),
                request.displayName().strip(), normalizeEmail(request.primaryEmail()), clock.instant());
        clients.save(client);
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "client.created", "client", client.id(),
                Map.of("displayName", client.displayName()));
        return view(client);
    }

    @Transactional
    public ClientView update(SelectedTenant tenant, UUID clientId, ClientRequest request) {
        requireWrite(tenant);
        ClientAccount client = requireClient(tenant, clientId);
        client.update(request.legalName().strip(), request.displayName().strip(),
                normalizeEmail(request.primaryEmail()), clock.instant());
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "client.updated", "client", client.id(),
                Map.of("displayName", client.displayName()));
        return view(client);
    }

    @Transactional
    public ClientView archive(SelectedTenant tenant, UUID clientId) {
        requireWrite(tenant);
        ClientAccount client = requireClient(tenant, clientId);
        client.archive(clock.instant());
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "client.archived", "client", client.id(), Map.of());
        return view(client);
    }

    private ClientAccount requireClient(SelectedTenant tenant, UUID clientId) {
        return clients.findByIdAndFirmId(clientId, tenant.firmId()).orElseThrow(ClientNotFoundException::new);
    }

    private void requireWrite(SelectedTenant tenant) {
        if (!tenant.canWrite()) throw new AccessDeniedException("Read-only members cannot change clients");
    }

    private String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    private ClientView view(ClientAccount client) {
        return new ClientView(client.id(), client.legalName(), client.displayName(),
                client.primaryEmail(), client.status(), client.version());
    }
}
