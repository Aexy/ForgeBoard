package com.forgeboard.engagement.application;

import java.time.LocalDate;
import java.util.UUID;

/** Safe owner-facing summary of a recoverable recurrence incident. */
public record RecurrenceFailureView(UUID id, UUID templateId, String templateName, LocalDate periodStart,
        int failedDefinitionVersion, int currentDefinitionVersion, String failureDetail,
        boolean automaticRetryAttempted, boolean generateNowDisabled) {}
