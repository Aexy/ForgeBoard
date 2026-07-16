package com.forgeboard.identity.application;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.ActivityEvent;
import com.forgeboard.identity.persistence.ActivityEventRepository;

@Service
public class ActivityQueryService {
    private final ActivityEventRepository events;
    private final TenantAuthorizationService authorization;
    public ActivityQueryService(ActivityEventRepository events, TenantAuthorizationService authorization) {
        this.events = events;
        this.authorization = authorization;
    }

    @Transactional(readOnly = true)
    public List<ActivityView> recent(SelectedTenant tenant, String targetType, UUID targetId) {
        List<ActivityEvent> result = targetType == null || targetId == null
                ? events.findTop100ByFirmIdOrderByOccurredAtDesc(tenant.firmId())
                : events.findTop100ByFirmIdAndTargetTypeAndTargetIdOrderByOccurredAtDesc(
                        tenant.firmId(), targetType, targetId);
        return result.stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public AuditTrailPage auditTrail(SelectedTenant tenant, AuditTrailFilter filter, String encodedCursor, int requestedLimit) {
        authorization.requireAuditTrailAccess(tenant);
        if (requestedLimit < 1 || requestedLimit > 100) throw new IllegalArgumentException("limit must be between 1 and 100");
        AuditTrailCursor cursor = AuditTrailCursor.decode(encodedCursor);
        List<ActivityEvent> fetched = events.findAuditTrail(tenant.firmId(), filter.action(), filter.actorType(),
                filter.source(), filter.from(), filter.to(), cursor == null ? null : cursor.occurredAt(),
                cursor == null ? null : cursor.eventId(), PageRequest.of(0, requestedLimit + 1));
        boolean hasNext = fetched.size() > requestedLimit;
        List<ActivityEvent> page = hasNext ? fetched.subList(0, requestedLimit) : fetched;
        String nextCursor = hasNext ? new AuditTrailCursor(page.getLast().occurredAt(), page.getLast().id()).encode() : null;
        return new AuditTrailPage(page.stream().map(this::view).toList(), nextCursor);
    }

    private ActivityView view(ActivityEvent event) {
        return new ActivityView(event.actorUserId(), event.actorType(), event.source(), event.action(),
                event.targetType(), event.targetId(), event.summary(), event.occurredAt());
    }
}
