package com.forgeboard.identity.application;

import com.forgeboard.identity.domain.MembershipRole;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InviteMemberRequest(
        @NotBlank @Size(max = 160) String displayName,
        @NotBlank @Email @Size(max = 320) String email,
        @NotNull MembershipRole role) {
    public InviteMemberRequest(String email, MembershipRole role) {
        this("", email, role);
    }
}
