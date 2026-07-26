package com.forgeboard.engagement;

import java.util.Optional;
import java.util.UUID;


/** Narrow engagement read contract consumed by the work module. */
public interface EngagementDetails {
    Optional<EngagementDetail> findByWorkItem(UUID firmId, UUID workItemId);
}
