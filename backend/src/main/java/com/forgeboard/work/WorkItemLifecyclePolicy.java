package com.forgeboard.work;

import java.util.UUID;

/**
 * Policy hook for lifecycle rules attached to a confirmed board move.
 *
 * <p>The work module owns this seam and supplies only immutable identifiers and
 * stage facts, so a policy implementation never needs work persistence entities.
 */
public interface WorkItemLifecyclePolicy {
    UUID onWorkItemMove(WorkItemLifecycleMove move);
}
