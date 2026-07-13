package com.forgeboard.document.application;

public class DocumentRequestNotFoundException extends RuntimeException {
    public DocumentRequestNotFoundException(String message) {
        super(message);
    }
}
