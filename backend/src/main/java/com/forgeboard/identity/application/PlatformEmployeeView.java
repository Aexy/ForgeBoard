package com.forgeboard.identity.application;

import java.util.UUID;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;

/** Deliberately narrow employee-membership projection for platform administration. */
public record PlatformEmployeeView(UUID membershipId, UUID userId, String displayName, String email,
        MembershipRole role, MembershipStatus status) {}
