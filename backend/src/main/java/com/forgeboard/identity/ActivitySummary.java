package com.forgeboard.identity;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Safe, tenant-scoped activity data for use by other application modules. */
public record ActivitySummary(UUID actorUserId, String actorType, String source, String action,
        String targetType, UUID targetId, Map<String, Object> summary, Instant occurredAt) {
}
