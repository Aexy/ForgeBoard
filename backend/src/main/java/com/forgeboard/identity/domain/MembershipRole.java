package com.forgeboard.identity.domain;

public enum MembershipRole {
    OWNER,
    ADMINISTRATOR,
    MANAGER,
    MEMBER,
    READ_ONLY;

    public boolean canManageMemberships() {
        return this == OWNER || this == ADMINISTRATOR;
    }

    public boolean canManageAssignments() {
        return this == OWNER || this == ADMINISTRATOR;
    }

    public boolean canViewAuditTrail() {
        return this == OWNER || this == MANAGER;
    }
}
