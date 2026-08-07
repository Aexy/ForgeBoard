package com.forgeboard.identity.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AcceptInvitationRequest(
        @NotBlank @Size(max = 512) String token,
        @Size(max = 160) String displayName,
        @Size(min = 12, max = 200) String password) {
    public AcceptInvitationRequest(String token) {
        this(token, null, null);
    }
}
