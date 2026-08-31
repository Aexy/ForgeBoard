package com.forgeboard.engagement.application;

import java.util.List;
import java.util.UUID;
import com.forgeboard.engagement.domain.Recurrence;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;

public record EngagementTemplateRequest(
        @NotBlank @Size(max = 160) String name,
        @NotNull UUID workflowId,
        @NotNull Recurrence recurrence,
        @NotBlank @Size(max = 200) String defaultWorkItemTitle,
        @Min(1) @Max(31) int dueDay,
        @Size(max = 50) List<@Valid ChecklistItemDefinitionRequest> checklistItems) {
    public EngagementTemplateRequest(String name, UUID workflowId, Recurrence recurrence,
            String defaultWorkItemTitle, int dueDay) {
        this(name, workflowId, recurrence, defaultWorkItemTitle, dueDay, List.of());
    }
    public List<ChecklistItemDefinitionRequest> checklistItemsOrEmpty() {
        return checklistItems == null ? List.of() : checklistItems;
    }
}
