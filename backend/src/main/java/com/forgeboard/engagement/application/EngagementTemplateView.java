package com.forgeboard.engagement.application;

import java.util.UUID;
import com.forgeboard.engagement.domain.Recurrence;

public record EngagementTemplateView(UUID id, String name, UUID workflowId, Recurrence recurrence,
        String defaultWorkItemTitle, int dueDay, long version) {}
