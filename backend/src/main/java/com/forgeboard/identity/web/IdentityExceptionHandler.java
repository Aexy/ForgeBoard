package com.forgeboard.identity.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.forgeboard.identity.application.DuplicateIdentityException;
import com.forgeboard.identity.application.InvalidIdentityException;

@RestControllerAdvice(assignableTypes = OnboardingController.class)
class IdentityExceptionHandler {
    @ExceptionHandler(DuplicateIdentityException.class)
    ProblemDetail duplicate(DuplicateIdentityException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler({InvalidIdentityException.class, MethodArgumentNotValidException.class})
    ProblemDetail invalid(Exception exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "The onboarding request is invalid");
    }
}
