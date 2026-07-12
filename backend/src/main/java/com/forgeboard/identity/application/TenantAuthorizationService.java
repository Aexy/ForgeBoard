package com.forgeboard.identity.application;

import java.util.Locale;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.UserRepository;

@Service
public class TenantAuthorizationService {
    private final UserRepository users;
    private final FirmMembershipRepository memberships;

    public TenantAuthorizationService(UserRepository users, FirmMembershipRepository memberships) {
        this.users = users;
        this.memberships = memberships;
    }

    public TenantPrincipal authorize(String email, UUID firmId) {
        ForgeBoardUser user = users.findByEmail(email.toLowerCase(Locale.ROOT))
                .filter(ForgeBoardUser::enabled)
                .orElseThrow(() -> new AccessDeniedException("User is not active"));
        FirmMembership membership = memberships.findByFirmIdAndUserId(firmId, user.id())
                .orElseThrow(() -> new AccessDeniedException("User is not a member of this firm"));
        return new TenantPrincipal(firmId, user.id(), user.email(), membership.role());
    }
}

