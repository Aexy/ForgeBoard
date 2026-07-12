package com.forgeboard.identity.application;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.forgeboard.identity.domain.ActivityActorType;
import com.forgeboard.identity.domain.ActivityEvent;
import com.forgeboard.identity.domain.ActivitySource;
import com.forgeboard.identity.persistence.ActivityEventRepository;

@Service
public class ActivityAuditService {
    private final ActivityEventRepository events;
    private final Clock clock;

    public ActivityAuditService(ActivityEventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    public void recordUserAction(UUID firmId, UUID actorUserId, ActivitySource source,
            String action, String targetType, UUID targetId, Map<String, Object> summary) {
        events.save(new ActivityEvent(UUID.randomUUID(), firmId, actorUserId, ActivityActorType.USER,
                source, action, targetType, targetId, summary, clock.instant()));
    }
}

