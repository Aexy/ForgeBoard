package com.forgeboard.work.application;
import java.time.LocalDate;
import java.util.UUID;
import com.forgeboard.work.domain.StageAttention;

public record EmployeeWorkItemView(UUID id, String title, UUID workflowId, UUID stageId, String stageName,
        StageAttention attention, LocalDate dueDate) {}
