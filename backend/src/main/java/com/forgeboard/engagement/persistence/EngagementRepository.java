package com.forgeboard.engagement.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.engagement.domain.Engagement;

public interface EngagementRepository extends JpaRepository<Engagement, UUID> {
    boolean existsByFirmIdAndTemplateIdAndClientIdAndPeriodStart(
            UUID firmId, UUID templateId, UUID clientId, LocalDate periodStart);

    List<Engagement> findAllByFirmIdOrderByDueDateAsc(UUID firmId);
}
