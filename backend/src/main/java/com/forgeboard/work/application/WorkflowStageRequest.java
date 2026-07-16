package com.forgeboard.work.application;

import com.forgeboard.work.domain.StageAttention;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record WorkflowStageRequest(
        @NotBlank @Size(max = 120) String name,
        @NotNull StageAttention attention) {}
