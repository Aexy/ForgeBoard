package com.forgeboard.work.application;

import java.util.UUID;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record MoveWorkItemRequest(@NotNull UUID targetStageId, UUID beforeItemId, UUID afterItemId,
        @NotNull @PositiveOrZero Long expectedVersion) {}
