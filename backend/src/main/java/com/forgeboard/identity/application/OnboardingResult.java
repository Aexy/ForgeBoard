package com.forgeboard.identity.application;

import java.util.UUID;

public record OnboardingResult(UUID firmId, String firmSlug, UUID ownerId, String ownerEmail) {}

