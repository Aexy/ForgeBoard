package com.forgeboard.identity.application;

import java.util.UUID;
import com.forgeboard.identity.domain.MembershipRole;

public record TenantPrincipal(UUID firmId, UUID userId, String email, MembershipRole role) {}

