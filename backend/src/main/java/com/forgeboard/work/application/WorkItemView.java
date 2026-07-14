package com.forgeboard.work.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import com.forgeboard.work.domain.WorkPriority;

public record WorkItemView(UUID id, UUID clientId, UUID stageId, String title,
        String description, LocalDate dueDate, WorkPriority priority, BigDecimal rank, long version, UUID ownerUserId) {}
