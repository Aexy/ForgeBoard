package com.forgeboard.engagement.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import com.forgeboard.engagement.application.EngagementNotFoundException;

@RestControllerAdvice(assignableTypes = EngagementController.class)
class EngagementExceptionHandler {
    @ExceptionHandler(EngagementNotFoundException.class)
    ProblemDetail notFound(EngagementNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }
}
