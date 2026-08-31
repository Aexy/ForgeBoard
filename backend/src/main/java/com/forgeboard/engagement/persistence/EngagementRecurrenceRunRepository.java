package com.forgeboard.engagement.persistence;

import java.time.LocalDate;
import java.util.UUID;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.engagement.domain.EngagementRecurrenceRun;

public interface EngagementRecurrenceRunRepository extends JpaRepository<EngagementRecurrenceRun, UUID> {
    boolean existsByFirmIdAndTemplateIdAndPeriodStart(UUID firmId, UUID templateId, LocalDate periodStart);
    java.util.Optional<EngagementRecurrenceRun> findByIdAndFirmId(UUID id, UUID firmId);
    List<EngagementRecurrenceRun> findAllByFirmIdAndStatusOrderByUpdatedAtAsc(UUID firmId, com.forgeboard.engagement.domain.RecurrenceRunStatus status);
    List<EngagementRecurrenceRun> findAllByStatusAndAutomaticRetryAttemptedFalseAndUpdatedAtLessThanEqual(
            com.forgeboard.engagement.domain.RecurrenceRunStatus status, Instant updatedAt);
}
