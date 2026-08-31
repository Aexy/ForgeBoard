package com.forgeboard.engagement.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.engagement.domain.EngagementChecklistItem;

public interface EngagementChecklistItemRepository extends JpaRepository<EngagementChecklistItem, UUID> {
    List<EngagementChecklistItem> findAllByFirmIdAndEngagementIdOrderByPositionAsc(UUID firmId, UUID engagementId);
    Optional<EngagementChecklistItem> findByIdAndFirmIdAndEngagementId(UUID id, UUID firmId, UUID engagementId);
    boolean existsByFirmIdAndEngagementIdAndRequiredTrueAndCompletedAtIsNull(UUID firmId, UUID engagementId);
}
