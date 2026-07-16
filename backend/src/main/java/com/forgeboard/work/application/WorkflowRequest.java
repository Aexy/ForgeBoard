package com.forgeboard.work.application;

import java.util.List;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WorkflowRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(min = 2, max = 10) List<@jakarta.validation.Valid WorkflowStageRequest> stages) {}
