package com.forgeboard.work.application;

import java.time.LocalDate;
import java.util.UUID;

public record DeadlineWorkItemView(UUID id, String title, UUID workflowId, UUID stageId, String stageName,
        LocalDate dueDate, String attention) {}
