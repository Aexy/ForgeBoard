package com.forgeboard.identity.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "firms")
public class Firm {
    @Id
    private UUID id;
    @Column(nullable = false, length = 160)
    private String name;
    @Column(nullable = false, unique = true, length = 80)
    private String slug;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private FirmStatus status;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version
    private long version;

    protected Firm() {}

    public Firm(UUID id, String name, String slug, Instant now) {
        this.id = id;
        this.name = name;
        this.slug = slug;
        this.status = FirmStatus.ACTIVE;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public UUID id() { return id; }
    public String name() { return name; }
    public String slug() { return slug; }
    public FirmStatus status() { return status; }
    public Instant createdAt() { return createdAt; }

    public void suspend(Instant now) {
        this.status = FirmStatus.SUSPENDED;
        this.updatedAt = now;
    }

    public void reactivate(Instant now) {
        this.status = FirmStatus.ACTIVE;
        this.updatedAt = now;
    }
}
