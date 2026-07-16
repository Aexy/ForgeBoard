package com.forgeboard.document;

import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.forgeboard.document.domain.DocumentRequest;
import com.forgeboard.document.persistence.DocumentRequestRepository;

/** Public document-module contract for tenant-scoped document-request lookup. */
@Service
public class DocumentRequestDirectory {
    private final DocumentRequestRepository requests;

    public DocumentRequestDirectory(DocumentRequestRepository requests) {
        this.requests = requests;
    }

    public Optional<DocumentRequestSummary> find(UUID firmId, UUID requestId) {
        return requests.findByIdAndFirmId(requestId, firmId).map(this::summary);
    }

    private DocumentRequestSummary summary(DocumentRequest request) {
        return new DocumentRequestSummary(request.id(), request.clientId(), request.label(), request.dueDate(),
                request.status().name(), request.receivedAt());
    }
}
