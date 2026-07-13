package com.forgeboard.document.application;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.client.ClientDirectory;
import com.forgeboard.document.domain.DocumentRequest;
import com.forgeboard.document.persistence.DocumentRequestRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;

@Service
public class DocumentRequestService {
    private final DocumentRequestRepository requests;
    private final ClientDirectory clients;
    private final ActivityRecorder activity;
    private final Clock clock;

    public DocumentRequestService(DocumentRequestRepository requests, ClientDirectory clients,
            ActivityRecorder activity, Clock clock) {
        this.requests = requests;
        this.clients = clients;
        this.activity = activity;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<DocumentRequestView> list(SelectedTenant tenant) {
        return requests.findAllByFirmIdOrderByDueDateAsc(tenant.firmId()).stream()
                .map(this::view)
                .toList();
    }

    @Transactional
    public DocumentRequestView create(SelectedTenant tenant, DocumentRequestInput input) {
        requireWrite(tenant);
        if (!clients.exists(tenant.firmId(), input.clientId())) {
            throw new DocumentRequestNotFoundException("Client was not found in the selected firm");
        }

        DocumentRequest request = requests.save(new DocumentRequest(
                UUID.randomUUID(), tenant.firmId(), input.clientId(), input.label().strip(),
                blankToNull(input.externalReference()), input.dueDate(), clock.instant()));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "document-request.created",
                "document-request", request.id(), Map.of("label", request.label()));
        return view(request);
    }

    @Transactional
    public DocumentRequestView receive(SelectedTenant tenant, UUID id) {
        requireWrite(tenant);
        DocumentRequest request = requests.findByIdAndFirmId(id, tenant.firmId())
                .orElseThrow(() -> new DocumentRequestNotFoundException(
                        "Document request was not found in the selected firm"));
        if (request.receive(clock.instant())) {
            activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "document-request.received",
                    "document-request", request.id(), Map.of("label", request.label()));
        }
        return view(request);
    }

    private DocumentRequestView view(DocumentRequest request) {
        return new DocumentRequestView(request.id(), request.clientId(), request.label(),
                request.externalReference(), request.dueDate(), request.status(), request.receivedAt(),
                request.version());
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private void requireWrite(SelectedTenant tenant) {
        if (!tenant.canWrite()) {
            throw new AccessDeniedException("Read-only members cannot change document requests");
        }
    }
}
