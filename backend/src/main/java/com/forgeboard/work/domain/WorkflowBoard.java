package com.forgeboard.work.domain;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "workflows")
public class WorkflowBoard {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(nullable = false, length = 160) private String name;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version private long version;

    protected WorkflowBoard() {}
    public WorkflowBoard(UUID id, UUID firmId, String name, Instant now) {
        this.id = id; this.firmId = firmId; this.name = name; this.createdAt = now; this.updatedAt = now;
    }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public String name() { return name; }
}

