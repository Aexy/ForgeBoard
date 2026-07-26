package com.forgeboard.engagement.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.engagement.domain.EngagementReviewDecision;

public interface EngagementReviewDecisionRepository extends JpaRepository<EngagementReviewDecision, UUID> {
    List<EngagementReviewDecision> findAllByFirmIdAndEngagementIdOrderByOccurredAtDescIdDesc(UUID firmId, UUID engagementId);
}
