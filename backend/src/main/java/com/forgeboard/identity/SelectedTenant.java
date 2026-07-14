package com.forgeboard.identity;

import java.util.UUID;
import com.forgeboard.identity.domain.MembershipRole;

public record SelectedTenant(UUID firmId, UUID userId, String email, MembershipRole role) {
    /** Public request contract populated by the identity security adapter. */
    public static final String REQUEST_ATTRIBUTE = "forgeboard.selectedTenant";
    public boolean canWrite() { return role != MembershipRole.READ_ONLY; }
}
