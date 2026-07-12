package com.forgeboard.identity.domain;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "activity_events")
public class ActivityEvent {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "actor_user_id") private UUID actorUserId;
    @Enumerated(EnumType.STRING) @Column(name = "actor_type", nullable = false) private ActivityActorType actorType;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private ActivitySource source;
    @Column(nullable = false, length = 100) private String action;
    @Column(name = "target_type", nullable = false, length = 100) private String targetType;
    @Column(name = "target_id") private UUID targetId;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private Map<String, Object> summary;
    @Column(name = "occurred_at", nullable = false) private Instant occurredAt;

    protected ActivityEvent() {}

    public ActivityEvent(UUID id, UUID firmId, UUID actorUserId, ActivityActorType actorType,
            ActivitySource source, String action, String targetType, UUID targetId,
            Map<String, Object> summary, Instant occurredAt) {
        this.id = id;
        this.firmId = firmId;
        this.actorUserId = actorUserId;
        this.actorType = actorType;
        this.source = source;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.summary = Map.copyOf(summary);
        this.occurredAt = occurredAt;
    }

    public UUID firmId() { return firmId; }
    public UUID actorUserId() { return actorUserId; }
    public ActivityActorType actorType() { return actorType; }
    public ActivitySource source() { return source; }
    public String action() { return action; }
    public String targetType() { return targetType; }
    public UUID targetId() { return targetId; }
    public Map<String, Object> summary() { return summary; }
    public Instant occurredAt() { return occurredAt; }
}
