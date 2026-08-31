package com.forgeboard.engagement.application;

import java.util.List;
import java.util.UUID;
import com.forgeboard.engagement.domain.Recurrence;

public record EngagementTemplateView(UUID id, String name, UUID workflowId, Recurrence recurrence,
        String defaultWorkItemTitle, int dueDay, long version, int currentVersion, long enrolledClientCount,
        List<TemplateChecklistItemView> checklistItems) {
    public EngagementTemplateView(UUID id, String name, UUID workflowId, Recurrence recurrence,
            String defaultWorkItemTitle, int dueDay, long version, int currentVersion, long enrolledClientCount) {
        this(id, name, workflowId, recurrence, defaultWorkItemTitle, dueDay, version, currentVersion,
                enrolledClientCount, List.of());
    }
}
