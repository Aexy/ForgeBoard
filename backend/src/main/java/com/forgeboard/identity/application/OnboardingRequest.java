package com.forgeboard.identity.application;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OnboardingRequest(
        @NotBlank @Size(max = 160) String firmName,
        @NotBlank @Size(max = 80) String firmSlug,
        @NotBlank @Email @Size(max = 320) String ownerEmail,
        @NotBlank @Size(max = 160) String ownerName,
        @NotBlank @Size(min = 12, max = 128) String password) {}

