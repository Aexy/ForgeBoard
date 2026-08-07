package com.forgeboard.identity.application;

import java.util.UUID;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;

/** Safe management projection. Invitation links are intentionally never included. */
public record EmployeeView(UUID membershipId, UUID userId, String displayName, String email, MembershipRole role,
        MembershipStatus status) {
    /** Compatibility constructor for active employee-directory projections. */
    public EmployeeView(UUID membershipId, UUID userId, String displayName, String email, MembershipRole role) {
        this(membershipId, userId, displayName, email, role, MembershipStatus.ACTIVE);
    }
}
