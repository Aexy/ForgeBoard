package com.forgeboard.document.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.forgeboard.document.application.DocumentRequestNotFoundException;

@RestControllerAdvice(assignableTypes = DocumentRequestController.class)
class DocumentRequestExceptionHandler {
    @ExceptionHandler(DocumentRequestNotFoundException.class)
    ProblemDetail notFound(DocumentRequestNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail forbidden(AccessDeniedException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, exception.getMessage());
    }
}
