package com.forgeboard.identity;

import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import com.forgeboard.identity.application.ActivityAuditService;
import com.forgeboard.identity.domain.ActivitySource;

@Service
public class ActivityRecorder {
    private final ActivityAuditService audit;

    public ActivityRecorder(ActivityAuditService audit) { this.audit = audit; }

    public void recordRestUserAction(UUID firmId, UUID actorUserId, String action,
            String targetType, UUID targetId, Map<String, Object> summary) {
        audit.recordUserAction(firmId, actorUserId, ActivitySource.REST,
                action, targetType, targetId, summary);
    }
}

