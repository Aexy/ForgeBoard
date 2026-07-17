package com.forgeboard.work.application;
import java.time.LocalDate;
import com.forgeboard.work.domain.StageAttention;

public record EmployeeWorkItemView(String taskReference, String title, String workflowSlug, String stageName,
        StageAttention attention, LocalDate dueDate) {}
