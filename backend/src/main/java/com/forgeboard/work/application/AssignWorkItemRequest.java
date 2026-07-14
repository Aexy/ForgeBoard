package com.forgeboard.work.application;

import java.util.UUID;
import jakarta.validation.constraints.NotNull;
public record AssignWorkItemRequest(@NotNull UUID ownerUserId) {}
