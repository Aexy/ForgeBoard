package com.forgeboard.work.application;

import java.time.LocalDate;
import java.util.UUID;
import com.forgeboard.work.domain.WorkPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record WorkItemRequest(
        @NotNull UUID clientId,
        @NotNull UUID stageId,
        @NotBlank @Size(max = 200) String title,
        @Size(max = 10000) String description,
        LocalDate dueDate,
        @NotNull WorkPriority priority) {}

