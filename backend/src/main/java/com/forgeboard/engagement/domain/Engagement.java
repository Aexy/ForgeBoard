package com.forgeboard.engagement.domain;

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
@Table(name = "engagements")
public class Engagement {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "template_id", nullable = false) private UUID templateId;
    @Column(name = "client_id", nullable = false) private UUID clientId;
    @Column(name = "workflow_id", nullable = false) private UUID workflowId;
    @Column(name = "work_item_id") private UUID workItemId;
    @Column(name = "period_start", nullable = false) private LocalDate periodStart;
    @Column(name = "period_end", nullable = false) private LocalDate periodEnd;
    @Column(name = "due_date", nullable = false) private LocalDate dueDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private EngagementStatus status;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version private long version;

    protected Engagement() {}
    public Engagement(UUID id, UUID firmId, UUID templateId, UUID clientId, UUID workflowId, UUID workItemId,
            LocalDate periodStart, LocalDate periodEnd, LocalDate dueDate, Instant now) {
        this.id = id; this.firmId = firmId; this.templateId = templateId; this.clientId = clientId;
        this.workflowId = workflowId; this.workItemId = workItemId; this.periodStart = periodStart; this.periodEnd = periodEnd;
        this.dueDate = dueDate; this.status = EngagementStatus.OPEN; this.createdAt = now; this.updatedAt = now;
    }
    public UUID id() { return id; }
    public UUID templateId() { return templateId; }
    public UUID clientId() { return clientId; }
    public UUID workflowId() { return workflowId; }
    public UUID workItemId() { return workItemId; }
    public LocalDate periodStart() { return periodStart; }
    public LocalDate periodEnd() { return periodEnd; }
    public LocalDate dueDate() { return dueDate; }
    public EngagementStatus status() { return status; }
    public long version() { return version; }
}
