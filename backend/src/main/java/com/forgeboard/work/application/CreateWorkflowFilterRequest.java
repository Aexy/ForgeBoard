package com.forgeboard.work.application;

import java.util.UUID;

import com.forgeboard.work.domain.WorkPriority;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateWorkflowFilterRequest(
        @NotBlank @Size(max = 80) String name,
        UUID clientId,
        UUID ownerUserId,
        @Pattern(regexp = "OVERDUE|DUE_TODAY|DUE_SOON|NO_DUE_DATE", message = "dueState must be a supported value") String dueState,
        WorkPriority priority,
        Boolean unassigned) {
}
