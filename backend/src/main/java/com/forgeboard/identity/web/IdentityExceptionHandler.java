package com.forgeboard.identity.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.converter.HttpMessageNotReadableException;

import com.forgeboard.identity.application.DuplicateIdentityException;
import com.forgeboard.identity.application.InvalidIdentityException;
import com.forgeboard.identity.application.PlatformAdministrationConflictException;

@RestControllerAdvice(assignableTypes = {OnboardingController.class, IdentityController.class,
        PlatformAdministrationController.class})
class IdentityExceptionHandler {
    @ExceptionHandler(DuplicateIdentityException.class)
    ProblemDetail duplicate(DuplicateIdentityException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail concurrentDuplicate(DataIntegrityViolationException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "The account or firm is already registered");
    }

    @ExceptionHandler({InvalidIdentityException.class, MethodArgumentNotValidException.class})
    ProblemDetail invalid(Exception exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "The identity request is invalid");
    }

    @ExceptionHandler(EntityNotFoundException.class)
    ProblemDetail notFound(EntityNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "The requested firm or employee was not found");
    }

    @ExceptionHandler(PlatformAdministrationConflictException.class)
    ProblemDetail conflict(PlatformAdministrationConflictException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail forbidden(AccessDeniedException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, exception.getMessage());
    }
}

@RestControllerAdvice(assignableTypes = AccessActionController.class)
class AccessActionExceptionHandler {
    private static final String GENERIC_ERROR = "This access link is invalid or has expired.";

    @ExceptionHandler({InvalidIdentityException.class, DuplicateIdentityException.class, AccessDeniedException.class,
            EntityNotFoundException.class, DataIntegrityViolationException.class, HttpMessageNotReadableException.class})
    ProblemDetail unavailable(RuntimeException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, GENERIC_ERROR);
    }
}
