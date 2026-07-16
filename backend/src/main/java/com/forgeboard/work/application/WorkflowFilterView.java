package com.forgeboard.work.application;

import java.util.UUID;

import com.forgeboard.work.domain.WorkPriority;

public record WorkflowFilterView(UUID id, String name, UUID clientId, UUID ownerUserId,
        String dueState, WorkPriority priority, Boolean unassigned) {
}
