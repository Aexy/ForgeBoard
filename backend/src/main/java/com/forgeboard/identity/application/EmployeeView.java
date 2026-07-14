package com.forgeboard.identity.application;

import java.util.UUID;
import com.forgeboard.identity.domain.MembershipRole;

public record EmployeeView(UUID membershipId, UUID userId, String displayName, String email, MembershipRole role) {}
