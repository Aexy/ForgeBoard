package com.forgeboard.engagement.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChecklistItemDefinitionRequest(
        @NotBlank @Size(max = 240) String label,
        boolean required) {}
