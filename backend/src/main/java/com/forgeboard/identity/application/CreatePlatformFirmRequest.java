package com.forgeboard.identity.application;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreatePlatformFirmRequest(
        @NotBlank @Size(max = 160) String name,
        @NotBlank @Size(max = 80) String slug,
        @NotBlank @Size(max = 160) String ownerName,
        @NotBlank @Email @Size(max = 320) String ownerEmail,
        @NotBlank @Size(min = 12, max = 200) String initialPassword) {}
