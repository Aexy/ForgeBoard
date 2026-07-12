package com.forgeboard.work.application;

import java.util.UUID;
import jakarta.validation.constraints.NotNull;

public record MoveWorkItemRequest(@NotNull UUID targetStageId, UUID beforeItemId, UUID afterItemId) {}

