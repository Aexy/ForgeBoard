package com.forgeboard.work.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record DocumentRequestSummaryView(UUID id, String label, LocalDate dueDate,
        String status, Instant receivedAt) {
}
