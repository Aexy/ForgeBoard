package com.forgeboard.identity.application;

import java.time.Instant;
import java.util.UUID;

/** The only application result that carries an unpersisted, one-time access token. */
public record GeneratedAccessLink(UUID actionId, String link, Instant expiresAt) { }
