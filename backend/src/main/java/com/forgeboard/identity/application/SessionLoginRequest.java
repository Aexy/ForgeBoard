package com.forgeboard.identity.application;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.annotation.JsonDeserialize;

public record SessionLoginRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(max = 128) String password,
        @JsonDeserialize(using = StrictBooleanDeserializer.class) Boolean remember) {
    public SessionLoginRequest(String email, String password) {
        this(email, password, null);
    }
}
