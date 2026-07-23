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
                and event.action = coalesce(:action, event.action)
                and event.actorType = coalesce(:actorType, event.actorType)
                and event.source = coalesce(:source, event.source)
                and event.occurredAt >= coalesce(:from, event.occurredAt)
                and event.occurredAt <= coalesce(:to, event.occurredAt)
                order by event.occurredAt desc, event.id desc
                """)
        List<ActivityEvent> findFirstAuditTrailPage(@Param("firmId") UUID firmId, @Param("action") String action,
                @Param("actorType") ActivityActorType actorType, @Param("source") ActivitySource source,
                @Param("from") Instant from, @Param("to") Instant to, Pageable pageable);

        @Query("""
                select event from ActivityEvent event
                where event.firmId = :firmId
                and event.action = coalesce(:action, event.action)
                and event.actorType = coalesce(:actorType, event.actorType)
                and event.source = coalesce(:source, event.source)
                and event.occurredAt >= coalesce(:from, event.occurredAt)
                and event.occurredAt <= coalesce(:to, event.occurredAt)
                and (event.occurredAt < :afterOccurredAt
                        or (event.occurredAt = :afterOccurredAt and event.id < :afterEventId))
                order by event.occurredAt desc, event.id desc
                """)
        List<ActivityEvent> findAuditTrailPageAfterCursor(@Param("firmId") UUID firmId, @Param("action") String action,
                @Param("actorType") ActivityActorType actorType, @Param("source") ActivitySource source,
                @Param("from") Instant from, @Param("to") Instant to,
                @Param("afterOccurredAt") Instant afterOccurredAt, @Param("afterEventId") UUID afterEventId,
                Pageable pageable);
}
