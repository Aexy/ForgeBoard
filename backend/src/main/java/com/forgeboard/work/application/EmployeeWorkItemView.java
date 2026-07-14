package com.forgeboard.work.application;
import java.time.LocalDate;
import java.util.UUID;
public record EmployeeWorkItemView(UUID id, String title, UUID workflowId, UUID stageId, String stageName, LocalDate dueDate) {}
