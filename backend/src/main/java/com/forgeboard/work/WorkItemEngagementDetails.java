package com.forgeboard.work;

import java.util.Optional;
import java.util.UUID;

/** Read seam for optional engagement context attached to a work item. */
public interface WorkItemEngagementDetails {
    Optional<WorkItemEngagementDetail> findByWorkItem(UUID firmId, UUID workItemId);
}
