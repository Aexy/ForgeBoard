package com.forgeboard.work.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "work_items")
public class WorkItem {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "client_id", nullable = false) private UUID clientId;
    @Column(name = "workflow_id", nullable = false) private UUID workflowId;
    @Column(name = "stage_id", nullable = false) private UUID stageId;
    @Column(nullable = false, length = 200) private String title;
    @Column(nullable = false) private String description;
    @Column(name = "due_date") private LocalDate dueDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24) private WorkPriority priority;
    @Column(nullable = false, precision = 30, scale = 10) private BigDecimal rank;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version private long version;

    protected WorkItem() {}
    public WorkItem(UUID id, UUID firmId, UUID clientId, UUID workflowId, UUID stageId,
            String title, String description, LocalDate dueDate, WorkPriority priority,
            BigDecimal rank, Instant now) {
        this.id = id; this.firmId = firmId; this.clientId = clientId; this.workflowId = workflowId;
        this.stageId = stageId; this.title = title; this.description = description;
        this.dueDate = dueDate; this.priority = priority; this.rank = rank;
        this.createdAt = now; this.updatedAt = now;
    }
    public void move(UUID stageId, BigDecimal rank, Instant now) { this.stageId = stageId; this.rank = rank; this.updatedAt = now; }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID clientId() { return clientId; }
    public UUID workflowId() { return workflowId; }
    public UUID stageId() { return stageId; }
    public String title() { return title; }
    public String description() { return description; }
    public LocalDate dueDate() { return dueDate; }
    public WorkPriority priority() { return priority; }
    public BigDecimal rank() { return rank; }
    public long version() { return version; }
}
