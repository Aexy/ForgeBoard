package com.forgeboard.identity.persistence;

import java.util.UUID;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.identity.domain.ActivityEvent;

public interface ActivityEventRepository extends JpaRepository<ActivityEvent, UUID> {
    List<ActivityEvent> findTop100ByFirmIdOrderByOccurredAtDesc(UUID firmId);
    List<ActivityEvent> findTop100ByFirmIdAndTargetTypeAndTargetIdOrderByOccurredAtDesc(
            UUID firmId, String targetType, UUID targetId);
}
