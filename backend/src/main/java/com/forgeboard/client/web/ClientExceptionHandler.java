package com.forgeboard.client.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import com.forgeboard.client.application.ClientNotFoundException;
import com.forgeboard.client.application.ClientImportValidationException;

@RestControllerAdvice(assignableTypes = ClientController.class)
class ClientExceptionHandler {
    @ExceptionHandler(ClientNotFoundException.class)
    ProblemDetail notFound(ClientNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail forbidden(AccessDeniedException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    @ExceptionHandler(ClientImportValidationException.class)
    ProblemDetail invalidImport(ClientImportValidationException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    }
}
