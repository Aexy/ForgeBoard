package com.forgeboard.identity;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.forgeboard.identity.application.ActivityQueryService;

/** Public identity-module contract for scoped activity lookup. */
@Service
public class ActivityDirectory {
    private final ActivityQueryService activity;

    public ActivityDirectory(ActivityQueryService activity) {
        this.activity = activity;
    }

    public List<ActivitySummary> recent(SelectedTenant tenant, String targetType, UUID targetId) {
        return activity.recent(tenant, targetType, targetId).stream()
                .map(event -> new ActivitySummary(event.actorUserId(), event.actorType().name(), event.source().name(),
                        event.action(), event.targetType(), event.targetId(), event.summary(), event.occurredAt()))
                .toList();
    }
}
