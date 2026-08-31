package com.forgeboard.engagement.application;

import java.time.Instant;
import java.util.UUID;

public record EngagementChecklistItemView(UUID id, String label, boolean required, int position,
        UUID completedBy, Instant completedAt, long version, boolean canUpdate) {
    public boolean isCompleted() { return completedAt != null; }
}
