package com.forgeboard.identity.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompletePasswordResetRequest(
        @NotBlank @Size(max = 512) String token,
        @NotBlank @Size(min = 12, max = 200) String password) { }
