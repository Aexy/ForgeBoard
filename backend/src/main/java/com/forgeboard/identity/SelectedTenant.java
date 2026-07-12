package com.forgeboard.identity;

import java.util.UUID;
import com.forgeboard.identity.domain.MembershipRole;

public record SelectedTenant(UUID firmId, UUID userId, String email, MembershipRole role) {
    public boolean canWrite() { return role != MembershipRole.READ_ONLY; }
}
