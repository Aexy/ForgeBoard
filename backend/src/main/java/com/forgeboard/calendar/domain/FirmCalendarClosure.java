package com.forgeboard.calendar.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "firm_calendar_closures")
public class FirmCalendarClosure {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "closure_date", nullable = false) private LocalDate closureDate;
    @Column(nullable = false, length = 160) private String label;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected FirmCalendarClosure() {}

    public FirmCalendarClosure(UUID id, UUID firmId, LocalDate closureDate, String label, UUID createdBy, Instant createdAt) {
        this.id = id; this.firmId = firmId; this.closureDate = closureDate; this.label = label;
        this.createdBy = createdBy; this.createdAt = createdAt;
    }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public LocalDate closureDate() { return closureDate; }
    public String label() { return label; }
    public UUID createdBy() { return createdBy; }
    public Instant createdAt() { return createdAt; }
}
