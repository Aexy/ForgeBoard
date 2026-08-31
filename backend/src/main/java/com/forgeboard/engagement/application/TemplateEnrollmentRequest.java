package com.forgeboard.engagement.application;

import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record TemplateEnrollmentRequest(@NotEmpty List<@NotNull UUID> clientIds) {}
