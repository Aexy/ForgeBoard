package com.forgeboard.client.application;

import java.util.UUID;
import com.forgeboard.client.domain.ClientStatus;

public record ClientView(UUID id, String legalName, String displayName,
        String primaryEmail, ClientStatus status, long version) {}

