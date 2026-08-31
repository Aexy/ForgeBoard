package com.forgeboard.engagement.domain;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "engagement_template_enrollments")
public class EngagementTemplateEnrollment {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "template_id", nullable = false) private UUID templateId;
    @Column(name = "client_id", nullable = false) private UUID clientId;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected EngagementTemplateEnrollment() {}

    public EngagementTemplateEnrollment(UUID id, UUID firmId, UUID templateId, UUID clientId, UUID createdBy, Instant createdAt) {
        this.id = id; this.firmId = firmId; this.templateId = templateId; this.clientId = clientId;
        this.createdBy = createdBy; this.createdAt = createdAt;
    }

    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID templateId() { return templateId; }
    public UUID clientId() { return clientId; }
    public UUID createdBy() { return createdBy; }
    public Instant createdAt() { return createdAt; }
}
