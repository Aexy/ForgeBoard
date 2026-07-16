package com.forgeboard.identity.web;

import java.util.List;
import java.util.UUID;
import java.time.Instant;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.ActivityQueryService;
import com.forgeboard.identity.application.ActivityView;
import com.forgeboard.identity.application.AuditTrailFilter;
import com.forgeboard.identity.application.AuditTrailPage;
import com.forgeboard.identity.domain.ActivityActorType;
import com.forgeboard.identity.domain.ActivitySource;
import com.forgeboard.identity.security.TenantSelectionFilter;

@RestController
@RequestMapping("/api/activity")
public class ActivityController {
    private final ActivityQueryService activity;
    public ActivityController(ActivityQueryService activity) { this.activity = activity; }

    @GetMapping
    List<ActivityView> recent(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) UUID targetId) {
        return activity.recent(tenant, targetType, targetId);
    }

    @GetMapping("/audit-trail")
    AuditTrailPage auditTrail(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) ActivityActorType actorType,
            @RequestParam(required = false) ActivitySource source,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit) {
        return activity.auditTrail(tenant, new AuditTrailFilter(action, actorType, source, from, to), cursor, limit);
    }
}
