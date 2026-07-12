package com.forgeboard.identity.web;

import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.ActivityQueryService;
import com.forgeboard.identity.application.ActivityView;
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
}
