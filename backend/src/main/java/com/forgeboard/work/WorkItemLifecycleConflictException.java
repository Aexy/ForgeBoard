package com.forgeboard.work;

/** A lifecycle policy rejected a board move before the work item was changed. */
public class WorkItemLifecycleConflictException extends RuntimeException {
    public WorkItemLifecycleConflictException(String message) {
        super(message);
    }
}
