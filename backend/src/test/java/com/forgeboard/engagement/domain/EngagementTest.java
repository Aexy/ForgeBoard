package com.forgeboard.engagement.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EngagementTest {
    private static final Instant NOW = Instant.parse("2026-07-24T09:00:00Z");

    @Test
    void progressesThroughReviewAndCompletion() {
        Engagement engagement = activeEngagement();

        engagement.submitForReview(NOW);
        engagement.approve(NOW.plusSeconds(1));

        assertThat(engagement.status()).isEqualTo(EngagementStatus.COMPLETE);
        assertThat(engagement.statusChangedAt()).isEqualTo(NOW.plusSeconds(1));
    }

    @Test
    void returnedReviewRestoresActiveWork() {
        Engagement engagement = activeEngagement();
        engagement.submitForReview(NOW);

        engagement.returnForPreparation(NOW.plusSeconds(1));

        assertThat(engagement.status()).isEqualTo(EngagementStatus.ACTIVE);
    }

    @Test
    void blocksAndResumesOnlyActiveWork() {
        Engagement engagement = activeEngagement();
        engagement.markBlocked(NOW);
        engagement.resumeActive(NOW.plusSeconds(1));

        assertThat(engagement.status()).isEqualTo(EngagementStatus.ACTIVE);
        assertThatThrownBy(() -> engagement.resumeActive(NOW.plusSeconds(2)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void cancellationCanBeReopened() {
        Engagement engagement = activeEngagement();
        engagement.cancel(NOW);
        engagement.reopen(NOW.plusSeconds(1));

        assertThat(engagement.status()).isEqualTo(EngagementStatus.ACTIVE);
    }

    @Test
    void archiveRestoresCompletionBeforeExplicitReopen() {
        Engagement engagement = activeEngagement();
        engagement.submitForReview(NOW);
        engagement.approve(NOW.plusSeconds(1));

        engagement.archive(NOW.plusSeconds(2));
        engagement.unarchive(NOW.plusSeconds(3));

        assertThat(engagement.status()).isEqualTo(EngagementStatus.COMPLETE);
        assertThat(engagement.archivedFromStatus()).isNull();
    }

    @Test
    void rejectsInvalidTransitions() {
        Engagement engagement = activeEngagement();

        assertThatThrownBy(() -> engagement.approve(NOW)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> engagement.returnForPreparation(NOW)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> engagement.resumeActive(NOW)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> engagement.archive(NOW)).isInstanceOf(IllegalStateException.class);

        engagement.cancel(NOW);
        assertThatThrownBy(() -> engagement.submitForReview(NOW.plusSeconds(1))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> engagement.cancel(NOW.plusSeconds(1))).isInstanceOf(IllegalStateException.class);
    }

    private Engagement activeEngagement() {
        return new Engagement(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID(), LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31), LocalDate.of(2026, 8, 20), NOW);
    }
}
