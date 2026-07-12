package com.forgeboard.identity.application;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SessionLoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

