package com.forgeboard.engagement.application;

import jakarta.validation.constraints.NotNull;

public record ExpectedVersionRequest(@NotNull Long expectedVersion) {}
