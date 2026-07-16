package com.forgeboard.work.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "saved_workflow_views")
public class SavedWorkflowView {
    @Id
    private UUID id;

    @Column(name = "firm_id", nullable = false)
    private UUID firmId;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "client_id")
    private UUID clientId;

    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    @Column(name = "due_state", length = 24)
    private String dueState;

    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    private WorkPriority priority;

    private Boolean unassigned;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected SavedWorkflowView() {
    }

    public SavedWorkflowView(UUID id, UUID firmId, String name, UUID clientId, UUID ownerUserId,
            String dueState, WorkPriority priority, Boolean unassigned, UUID createdByUserId, Instant now) {
        this.id = id;
        this.firmId = firmId;
        this.name = name;
        this.clientId = clientId;
        this.ownerUserId = ownerUserId;
        this.dueState = dueState;
        this.priority = priority;
        this.unassigned = unassigned;
        this.createdByUserId = createdByUserId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public String name() { return name; }
    public UUID clientId() { return clientId; }
    public UUID ownerUserId() { return ownerUserId; }
    public String dueState() { return dueState; }
    public WorkPriority priority() { return priority; }
    public Boolean unassigned() { return unassigned; }
    public UUID createdByUserId() { return createdByUserId; }
    public Instant createdAt() { return createdAt; }
    public long version() { return version; }
}
