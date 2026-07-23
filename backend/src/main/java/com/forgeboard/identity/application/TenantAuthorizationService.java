package com.forgeboard.identity.application;

import java.util.Locale;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.FirmStatus;
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@Service
public class TenantAuthorizationService {
    private final UserRepository users;
    private final FirmMembershipRepository memberships;
    private final FirmRepository firms;

    public TenantAuthorizationService(UserRepository users, FirmMembershipRepository memberships, FirmRepository firms) {
        this.users = users;
        this.memberships = memberships;
        this.firms = firms;
    }

    public SelectedTenant authorize(String email, UUID firmId) {
        ForgeBoardUser user = users.findByEmail(email.toLowerCase(Locale.ROOT))
                .filter(ForgeBoardUser::enabled)
                .orElseThrow(() -> new AccessDeniedException("User is not active"));
        FirmMembership membership = memberships.findByFirmIdAndUserId(firmId, user.id())
                .orElseThrow(() -> new AccessDeniedException("User is not a member of this firm"));
        if (membership.status() != MembershipStatus.ACTIVE)
            throw new AccessDeniedException("User is not an active member of this firm");
        if (firms.findById(firmId).filter(firm -> firm.status() == FirmStatus.ACTIVE).isEmpty())
            throw new AccessDeniedException("Firm is not active");
        return new SelectedTenant(firmId, user.id(), user.email(), membership.role());
    }

    public void requireMembershipManagement(SelectedTenant tenant) {
        if (!tenant.role().canManageMemberships())
            throw new AccessDeniedException("Only owners and administrators can manage employees");
    }

    public void requireAssignmentManagement(SelectedTenant tenant) {
        if (!tenant.role().canManageAssignments())
            throw new AccessDeniedException("Only owners and administrators can assign work items");
    }

    public void requireAuditTrailAccess(SelectedTenant tenant) {
        if (!tenant.role().canViewAuditTrail())
            throw new AccessDeniedException("Only owners and managers can view the audit trail");
    }
}
