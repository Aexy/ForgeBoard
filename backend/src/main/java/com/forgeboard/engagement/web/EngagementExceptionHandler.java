package com.forgeboard.engagement.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import com.forgeboard.engagement.application.EngagementAlreadyExistsException;
import com.forgeboard.engagement.application.EngagementNotFoundException;

@RestControllerAdvice(assignableTypes = EngagementController.class)
class EngagementExceptionHandler {
    @ExceptionHandler(EngagementNotFoundException.class)
    ProblemDetail notFound(EngagementNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(EngagementAlreadyExistsException.class)
    ProblemDetail conflict(EngagementAlreadyExistsException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler({IllegalStateException.class, com.forgeboard.work.WorkItemLifecycleConflictException.class})
    ProblemDetail lifecycleConflict(RuntimeException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail concurrentConflict(DataIntegrityViolationException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "The engagement could not be saved because it conflicts with an existing record");
    }

    @ExceptionHandler({ObjectOptimisticLockingFailureException.class, jakarta.persistence.OptimisticLockException.class})
    ProblemDetail optimisticConflict(RuntimeException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "The engagement was changed by another user; refresh and try again");
    }
}
