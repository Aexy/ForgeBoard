package com.forgeboard.client.domain;

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
@Table(name = "clients")
public class ClientAccount {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "legal_name", nullable = false, length = 200) private String legalName;
    @Column(name = "display_name", nullable = false, length = 160) private String displayName;
    @Column(name = "primary_email", length = 320) private String primaryEmail;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24) private ClientStatus status;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version private long version;

    protected ClientAccount() {}

    public ClientAccount(UUID id, UUID firmId, String legalName, String displayName,
            String primaryEmail, Instant now) {
        this.id = id;
        this.firmId = firmId;
        this.legalName = legalName;
        this.displayName = displayName;
        this.primaryEmail = primaryEmail;
        this.status = ClientStatus.ACTIVE;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(String legalName, String displayName, String primaryEmail, Instant now) {
        this.legalName = legalName;
        this.displayName = displayName;
        this.primaryEmail = primaryEmail;
        this.updatedAt = now;
    }

    public void archive(Instant now) { this.status = ClientStatus.ARCHIVED; this.updatedAt = now; }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public String legalName() { return legalName; }
    public String displayName() { return displayName; }
    public String primaryEmail() { return primaryEmail; }
    public ClientStatus status() { return status; }
    public long version() { return version; }
}

