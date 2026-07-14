package com.forgeboard.work.application;

public class WorkItemConflictException extends RuntimeException {
    public WorkItemConflictException() {
        super("The work item was changed by another user. Refresh the board and try again.");
    }
}
