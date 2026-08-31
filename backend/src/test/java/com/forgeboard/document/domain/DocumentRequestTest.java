package com.forgeboard.document.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.forgeboard.document.application.DocumentRequestFollowUpState;

class DocumentRequestTest {
    private static final Instant NOW = Instant.parse("2026-08-31T09:00:00Z");
    private static final Instant LATER = Instant.parse("2026-08-31T10:00:00Z");

    @Test
    void recordsEachFollowUpFactOnceAndDerivesState() {
        DocumentRequest request = request();

        assertThat(request.followUpState()).isEqualTo(DocumentRequestFollowUpState.OPEN);
        assertThat(request.recordReminder(NOW)).isTrue();
        assertThat(request.remindedAt()).isEqualTo(NOW);
        assertThat(request.followUpState()).isEqualTo(DocumentRequestFollowUpState.REMINDER_RECORDED);
        assertThat(request.escalate(LATER)).isTrue();
        assertThat(request.escalatedAt()).isEqualTo(LATER);
        assertThat(request.followUpState()).isEqualTo(DocumentRequestFollowUpState.ESCALATED);
        assertThat(request.recordReminder(LATER)).isFalse();
        assertThat(request.escalate(LATER)).isFalse();
    }

    @Test
    void receiptIsTerminalForFollowUpActions() {
        DocumentRequest request = request();

        request.receive(NOW);

        assertThat(request.recordReminder(LATER)).isFalse();
        assertThat(request.escalate(LATER)).isFalse();
        assertThat(request.followUpState()).isEqualTo(DocumentRequestFollowUpState.RECEIVED);
    }

    @Test
    void escalationRequiresReminder() {
        DocumentRequest request = request();

        assertThat(request.escalate(NOW)).isFalse();
        assertThat(request.followUpState()).isEqualTo(DocumentRequestFollowUpState.OPEN);
    }

    private static DocumentRequest request() {
        return new DocumentRequest(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "Bank statements", null, LocalDate.of(2026, 9, 15), NOW);
    }
}
