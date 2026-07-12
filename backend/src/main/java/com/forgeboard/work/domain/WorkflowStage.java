package com.forgeboard.work.domain;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "workflow_stages")
public class WorkflowStage {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "workflow_id", nullable = false) private UUID workflowId;
    @Column(nullable = false, length = 120) private String name;
    @Column(nullable = false) private int position;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version private long version;

    protected WorkflowStage() {}
    public WorkflowStage(UUID id, UUID firmId, UUID workflowId, String name, int position, Instant now) {
        this.id = id; this.firmId = firmId; this.workflowId = workflowId; this.name = name;
        this.position = position; this.createdAt = now; this.updatedAt = now;
    }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID workflowId() { return workflowId; }
    public String name() { return name; }
    public int position() { return position; }
}

