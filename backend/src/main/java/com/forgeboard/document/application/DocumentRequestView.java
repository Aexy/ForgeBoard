package com.forgeboard.document.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.forgeboard.document.domain.DocumentRequestStatus;

public record DocumentRequestView(UUID id, UUID clientId, String label, String externalReference, LocalDate dueDate,
        DocumentRequestStatus status, Instant receivedAt, long version, DocumentRequestFollowUpState followUpState,
        Instant remindedAt, Instant escalatedAt) {
}
