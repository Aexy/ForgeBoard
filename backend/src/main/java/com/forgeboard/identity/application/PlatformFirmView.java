package com.forgeboard.identity.application;

import java.time.Instant;
import java.util.UUID;
import com.forgeboard.identity.domain.FirmStatus;

/** Deliberately narrow platform-administration projection; never contains tenant work data. */
public record PlatformFirmView(UUID id, String name, String slug, FirmStatus status, Instant createdAt,
        long employeeCount) {}
