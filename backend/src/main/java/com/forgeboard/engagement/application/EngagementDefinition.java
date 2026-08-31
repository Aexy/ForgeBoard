package com.forgeboard.engagement.application;

import java.util.UUID;
import com.forgeboard.engagement.domain.EngagementTemplate;
import com.forgeboard.engagement.domain.EngagementTemplateVersion;
import com.forgeboard.engagement.domain.Recurrence;

/** Immutable input to engagement materialization, sourced from a template definition snapshot. */
public record EngagementDefinition(UUID templateId, int version, UUID workflowId, String templateName,
        Recurrence recurrence, String defaultWorkItemTitle, int dueDay) {
    static EngagementDefinition current(EngagementTemplate template) {
        return new EngagementDefinition(template.id(), template.currentVersion(), template.workflowId(), template.name(),
                template.recurrence(), template.defaultWorkItemTitle(), template.dueDay());
    }
    static EngagementDefinition snapshot(EngagementTemplateVersion version) {
        return new EngagementDefinition(version.templateId(), version.definitionVersion(), version.workflowId(), version.name(),
                version.recurrence(), version.defaultWorkItemTitle(), version.dueDay());
    }
}
