package com.forgeboard.client.application;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ClientRequest(
        @NotBlank @Size(max = 200) String legalName,
        @NotBlank @Size(max = 160) String displayName,
        @Email @Size(max = 320) String primaryEmail) {}

