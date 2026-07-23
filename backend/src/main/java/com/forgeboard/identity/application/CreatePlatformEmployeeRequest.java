package com.forgeboard.identity.application;

import com.forgeboard.identity.domain.MembershipRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreatePlatformEmployeeRequest(
        @NotBlank @Size(max = 160) String displayName,
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(min = 12, max = 200) String initialPassword,
        @NotNull MembershipRole role) {}
