package com.forgeboard.identity.application;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

public record AuditTrailCursor(Instant occurredAt, UUID eventId) {
    public static AuditTrailCursor decode(String encoded) {
        if (encoded == null || encoded.isBlank()) return null;
        try {
            String[] parts = new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8).split("\\|", -1);
            if (parts.length != 2) throw new IllegalArgumentException();
            return new AuditTrailCursor(Instant.parse(parts[0]), UUID.fromString(parts[1]));
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Invalid audit-trail cursor");
        }
    }

    public String encode() {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(
                (occurredAt + "|" + eventId).getBytes(StandardCharsets.UTF_8));
    }
}
