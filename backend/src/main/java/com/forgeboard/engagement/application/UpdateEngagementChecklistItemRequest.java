package com.forgeboard.engagement.application;

import jakarta.validation.constraints.Min;

public record UpdateEngagementChecklistItemRequest(boolean completed, @Min(0) long expectedVersion) {}
