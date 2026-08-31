package com.forgeboard.engagement.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "engagement_recurrence_runs")
public class EngagementRecurrenceRun {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "template_id", nullable = false) private UUID templateId;
    @Column(name = "period_start", nullable = false) private LocalDate periodStart;
    @Column(name = "definition_version", nullable = false) private int definitionVersion;
    @Column(name = "run_date", nullable = false) private LocalDate runDate;
    @Column(name = "generated_count", nullable = false) private int generatedCount;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private RecurrenceRunStatus status;
    @Column(name = "failure_detail", length = 500) private String failureDetail;
    @Column(name = "automatic_retry_attempted", nullable = false) private boolean automaticRetryAttempted;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    protected EngagementRecurrenceRun() {}
    public EngagementRecurrenceRun(UUID id, UUID firmId, UUID templateId, LocalDate periodStart, int definitionVersion,
            LocalDate runDate, int generatedCount, Instant now) {
        this.id = id; this.firmId = firmId; this.templateId = templateId; this.periodStart = periodStart;
        this.definitionVersion = definitionVersion; this.runDate = runDate; this.generatedCount = generatedCount;
        this.status = RecurrenceRunStatus.SUCCEEDED; this.createdAt = now; this.updatedAt = now;
    }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID templateId() { return templateId; }
    public LocalDate periodStart() { return periodStart; }
    public int definitionVersion() { return definitionVersion; }
    public LocalDate runDate() { return runDate; }
    public int generatedCount() { return generatedCount; }
    public RecurrenceRunStatus status() { return status; }
    public String failureDetail() { return failureDetail; }
    public boolean automaticRetryAttempted() { return automaticRetryAttempted; }
    public Instant updatedAt() { return updatedAt; }

    public static EngagementRecurrenceRun failed(UUID id, UUID firmId, UUID templateId, LocalDate periodStart,
            int definitionVersion, LocalDate runDate, String detail, Instant now) {
        EngagementRecurrenceRun run = new EngagementRecurrenceRun(id, firmId, templateId, periodStart,
                definitionVersion, runDate, 0, now);
        run.status = RecurrenceRunStatus.FAILED;
        run.failureDetail = detail == null ? "Generation failed" : detail.substring(0, Math.min(500, detail.length()));
        return run;
    }

    public void recordAutomaticRetryAttempt(Instant now) { this.automaticRetryAttempted = true; this.updatedAt = now; }
    public void succeed(int generatedCount, Instant now) {
        this.generatedCount = generatedCount; this.status = RecurrenceRunStatus.SUCCEEDED;
        this.failureDetail = null; this.updatedAt = now;
    }
    public void resolve(Instant now) { this.status = RecurrenceRunStatus.RESOLVED; this.updatedAt = now; }
}
