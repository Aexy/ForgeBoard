package com.forgeboard.work;

import java.util.UUID;

import org.springframework.stereotype.Service;

import com.forgeboard.work.domain.AssignmentRole;
import com.forgeboard.work.persistence.WorkItemAssignmentRepository;

@Service
public class WorkItemAssignmentDirectory {
    private final WorkItemAssignmentRepository assignments;

    public WorkItemAssignmentDirectory(WorkItemAssignmentRepository assignments) {
        this.assignments = assignments;
    }

    public WorkItemAssignmentRoles roles(UUID firmId, UUID workItemId) {
        UUID owner = null;
        UUID reviewer = null;
        for (var assignment : assignments.findAllByFirmIdAndWorkItemId(firmId, workItemId)) {
            if (assignment.assignmentRole() == AssignmentRole.OWNER) owner = assignment.userId();
            if (assignment.assignmentRole() == AssignmentRole.REVIEWER) reviewer = assignment.userId();
        }
        return new WorkItemAssignmentRoles(owner, reviewer);
    }
}
