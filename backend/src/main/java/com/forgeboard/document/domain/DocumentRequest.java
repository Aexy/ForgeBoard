package com.forgeboard.document.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.forgeboard.document.DocumentRequestStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "document_requests")
public class DocumentRequest {
    @Id
    private UUID id;

    @Column(name = "firm_id", nullable = false)
    private UUID firmId;

    @Column(name = "client_id", nullable = false)
    private UUID clientId;

    @Column(nullable = false, length = 200)
    private String label;

    @Column(name = "external_reference", length = 1000)
    private String externalReference;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DocumentRequestStatus status;

    @Column(name = "received_at")
    private Instant receivedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected DocumentRequest() {
    }

    public DocumentRequest(UUID id, UUID firmId, UUID clientId, String label,
            String externalReference, LocalDate dueDate, Instant now) {
        this.id = id;
        this.firmId = firmId;
        this.clientId = clientId;
        this.label = label;
        this.externalReference = externalReference;
        this.dueDate = dueDate;
        this.status = DocumentRequestStatus.REQUESTED;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public boolean receive(Instant now) {
        if (status == DocumentRequestStatus.RECEIVED) return false;
        status = DocumentRequestStatus.RECEIVED;
        receivedAt = now;
        updatedAt = now;
        return true;
    }

    public UUID id() {
        return id;
    }

    public UUID clientId() {
        return clientId;
    }

    public String label() {
        return label;
    }

    public String externalReference() {
        return externalReference;
    }

    public LocalDate dueDate() {
        return dueDate;
    }

    public DocumentRequestStatus status() {
        return status;
    }

    public Instant receivedAt() {
        return receivedAt;
    }

    public long version() {
        return version;
    }
}
