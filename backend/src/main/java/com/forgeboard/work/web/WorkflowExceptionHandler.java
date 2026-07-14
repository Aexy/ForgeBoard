package com.forgeboard.work.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import com.forgeboard.work.application.WorkNotFoundException;
import com.forgeboard.work.application.WorkItemConflictException;

@RestControllerAdvice(assignableTypes = WorkflowController.class)
class WorkflowExceptionHandler {
    @ExceptionHandler(WorkNotFoundException.class)
    ProblemDetail notFound(WorkNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }
    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail forbidden(AccessDeniedException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, exception.getMessage());
    }
    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail invalidMove(IllegalArgumentException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    }
    @ExceptionHandler(WorkItemConflictException.class)
    ProblemDetail conflict(WorkItemConflictException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }
}
