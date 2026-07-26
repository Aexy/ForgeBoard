package com.forgeboard.work.application;

import java.util.UUID;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record MoveWorkItemRequest(@NotNull UUID targetStageId, UUID beforeItemId, UUID afterItemId,
        @NotNull @PositiveOrZero Long expectedVersion, @Size(max = 4000) String reviewNote) {
    public MoveWorkItemRequest(UUID targetStageId, UUID beforeItemId, UUID afterItemId, Long expectedVersion) {
        this(targetStageId, beforeItemId, afterItemId, expectedVersion, null);
    }
}
