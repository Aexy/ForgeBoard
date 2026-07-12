package com.forgeboard.identity.application;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.ActivityEvent;
import com.forgeboard.identity.persistence.ActivityEventRepository;

@Service
public class ActivityQueryService {
    private final ActivityEventRepository events;
    public ActivityQueryService(ActivityEventRepository events) { this.events = events; }

    @Transactional(readOnly = true)
    public List<ActivityView> recent(SelectedTenant tenant, String targetType, UUID targetId) {
        List<ActivityEvent> result = targetType == null || targetId == null
                ? events.findTop100ByFirmIdOrderByOccurredAtDesc(tenant.firmId())
                : events.findTop100ByFirmIdAndTargetTypeAndTargetIdOrderByOccurredAtDesc(
                        tenant.firmId(), targetType, targetId);
        return result.stream().map(this::view).toList();
    }

    private ActivityView view(ActivityEvent event) {
        return new ActivityView(event.actorUserId(), event.actorType(), event.source(), event.action(),
                event.targetType(), event.targetId(), event.summary(), event.occurredAt());
    }
}

