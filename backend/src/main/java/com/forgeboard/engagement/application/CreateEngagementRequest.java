package com.forgeboard.engagement.application;

import java.time.LocalDate;
import java.util.UUID;
import jakarta.validation.constraints.NotNull;

public record CreateEngagementRequest(@NotNull UUID clientId, @NotNull LocalDate periodStart) {}
