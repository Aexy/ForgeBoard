package com.forgeboard.engagement.application;

public class EngagementAlreadyExistsException extends RuntimeException {
    public EngagementAlreadyExistsException(String message) {
        super(message);
    }
}
