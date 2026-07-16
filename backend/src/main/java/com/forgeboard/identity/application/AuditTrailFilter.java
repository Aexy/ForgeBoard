package com.forgeboard.identity.application;

import java.time.Instant;
import com.forgeboard.identity.domain.ActivityActorType;
import com.forgeboard.identity.domain.ActivitySource;

public record AuditTrailFilter(String action, ActivityActorType actorType, ActivitySource source,
        Instant from, Instant to) {
    public AuditTrailFilter {
        if (from != null && to != null && from.isAfter(to))
            throw new IllegalArgumentException("from must not be after to");
    }
}
