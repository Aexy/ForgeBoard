package com.forgeboard.engagement.application;

import java.util.UUID;
import com.forgeboard.engagement.domain.Recurrence;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EngagementTemplateRequest(
        @NotBlank @Size(max = 160) String name,
        @NotNull UUID workflowId,
        @NotNull Recurrence recurrence,
        @NotBlank @Size(max = 200) String defaultWorkItemTitle,
        @Min(1) @Max(31) int dueDay) {}
