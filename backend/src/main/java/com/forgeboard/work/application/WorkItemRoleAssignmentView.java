package com.forgeboard.work.application;

import java.util.UUID;

import com.forgeboard.work.domain.AssignmentRole;

public record WorkItemRoleAssignmentView(UUID workItemId, UUID userId, AssignmentRole role) {
}
