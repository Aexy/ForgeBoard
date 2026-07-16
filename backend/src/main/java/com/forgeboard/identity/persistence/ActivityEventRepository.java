package com.forgeboard.identity.persistence;

import java.util.UUID;
import java.util.List;
import java.time.Instant;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.forgeboard.identity.domain.ActivityActorType;
import com.forgeboard.identity.domain.ActivitySource;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.identity.domain.ActivityEvent;

public interface ActivityEventRepository extends JpaRepository<ActivityEvent, UUID> {
    List<ActivityEvent> findTop100ByFirmIdOrderByOccurredAtDesc(UUID firmId);
    List<ActivityEvent> findTop100ByFirmIdAndTargetTypeAndTargetIdOrderByOccurredAtDesc(
            UUID firmId, String targetType, UUID targetId);

    @Query("""
            select event from ActivityEvent event
            where event.firmId = :firmId
              and (:action is null or event.action = :action)
              and (:actorType is null or event.actorType = :actorType)
              and (:source is null or event.source = :source)
              and (:from is null or event.occurredAt >= :from)
              and (:to is null or event.occurredAt <= :to)
              and (:afterOccurredAt is null or event.occurredAt < :afterOccurredAt
                   or (event.occurredAt = :afterOccurredAt and event.id < :afterEventId))
            order by event.occurredAt desc, event.id desc
            """)
    List<ActivityEvent> findAuditTrail(@Param("firmId") UUID firmId, @Param("action") String action,
            @Param("actorType") ActivityActorType actorType, @Param("source") ActivitySource source,
            @Param("from") Instant from, @Param("to") Instant to,
            @Param("afterOccurredAt") Instant afterOccurredAt, @Param("afterEventId") UUID afterEventId,
            Pageable pageable);
}
