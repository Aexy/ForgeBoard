package com.forgeboard.engagement.application;

import java.util.UUID;

/** Active enrolled client data exposed by the template-enrollment API. */
public record TemplateEnrollmentClientView(UUID id, String legalName, String displayName,
        String primaryEmail, long version) {}
