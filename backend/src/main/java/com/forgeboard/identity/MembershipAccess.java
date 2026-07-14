package com.forgeboard.identity;

import java.util.UUID;
import org.springframework.stereotype.Service;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.persistence.FirmMembershipRepository;

/** Public identity-module contract for firm-scoped membership capability checks. */
@Service
public class MembershipAccess {
    private final TenantAuthorizationService authorization;
    private final FirmMembershipRepository memberships;
    public MembershipAccess(TenantAuthorizationService authorization, FirmMembershipRepository memberships) {
        this.authorization = authorization; this.memberships = memberships;
    }
    public void requireAssignmentManagement(SelectedTenant tenant) { authorization.requireAssignmentManagement(tenant); }
    public boolean belongsToFirm(UUID firmId, UUID userId) { return memberships.existsByFirmIdAndUserId(firmId, userId); }
}
