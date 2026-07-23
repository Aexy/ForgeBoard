package com.forgeboard.identity.application;

import com.forgeboard.identity.domain.MembershipRole;
import jakarta.validation.constraints.NotNull;

public record UpdateMembershipRoleRequest(@NotNull MembershipRole role) {}
