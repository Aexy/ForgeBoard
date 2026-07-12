package com.forgeboard.identity.application;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import com.forgeboard.identity.domain.ActivityActorType;
import com.forgeboard.identity.domain.ActivitySource;

public record ActivityView(UUID actorUserId, ActivityActorType actorType, ActivitySource source,
        String action, String targetType, UUID targetId, Map<String, Object> summary, Instant occurredAt) {}

