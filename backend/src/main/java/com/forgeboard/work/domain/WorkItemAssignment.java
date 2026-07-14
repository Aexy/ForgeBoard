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
@Table(name = "work_item_assignments")
public class WorkItemAssignment {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "work_item_id", nullable = false) private UUID workItemId;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Enumerated(EnumType.STRING) @Column(name = "assignment_role", nullable = false) private AssignmentRole assignmentRole;
    @Column(name = "assigned_at", nullable = false) private Instant assignedAt;
    @Column(name = "assigned_by_user_id", nullable = false) private UUID assignedByUserId;
    @Version private long version;
    protected WorkItemAssignment() {}
    public WorkItemAssignment(UUID id, UUID firmId, UUID workItemId, UUID userId, AssignmentRole assignmentRole,
            Instant assignedAt, UUID assignedByUserId) {
        this.id = id; this.firmId = firmId; this.workItemId = workItemId; this.userId = userId;
        this.assignmentRole = assignmentRole; this.assignedAt = assignedAt; this.assignedByUserId = assignedByUserId;
    }
    public UUID userId() { return userId; }
}
