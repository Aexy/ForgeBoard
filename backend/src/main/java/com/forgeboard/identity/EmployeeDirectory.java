package com.forgeboard.identity;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.application.EmployeeView;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.UserRepository;

/** Public identity-module contract for tenant-scoped employee display names. */
@Service
public class EmployeeDirectory {
    private final FirmMembershipRepository memberships;
    private final UserRepository users;

    public EmployeeDirectory(FirmMembershipRepository memberships, UserRepository users) {
        this.memberships = memberships;
        this.users = users;
    }

    public List<EmployeeView> list(UUID firmId) {
        return memberships.findStaffByFirmIdOrderByCreatedAtAsc(firmId).stream()
                .map(row -> new EmployeeView(row.membershipId(), row.userId(), row.displayName(), row.email(), row.role()))
                .toList();
    }

    public Map<UUID, String> displayNames(UUID firmId, Collection<UUID> userIds) {
        if (userIds.isEmpty()) return Map.of();
        var memberIds = memberships.findAllByFirmIdAndUserIdIn(firmId, userIds).stream()
                .map(membership -> membership.userId()).toList();
        return users.findAllById(memberIds).stream()
                .collect(java.util.stream.Collectors.toMap(ForgeBoardUser::id, ForgeBoardUser::displayName));
    }
}
