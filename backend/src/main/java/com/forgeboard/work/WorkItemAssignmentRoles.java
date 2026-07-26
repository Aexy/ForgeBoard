package com.forgeboard.work;

import java.util.UUID;

/** The two assignment identities needed by the engagement lifecycle. */
public record WorkItemAssignmentRoles(UUID ownerUserId, UUID reviewerUserId) {}
