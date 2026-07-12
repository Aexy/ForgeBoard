package com.forgeboard.identity.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
        this.createdAt = now;
        this.updatedAt = now;
    }

    public UUID id() { return id; }
    public String name() { return name; }
    public String slug() { return slug; }
}

