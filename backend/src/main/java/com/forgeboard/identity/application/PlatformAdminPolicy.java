package com.forgeboard.identity.application;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/** Server-side entitlement for the platform-administration boundary. */
@Component
@ConfigurationProperties(prefix = "forgeboard.platform-admin")
public class PlatformAdminPolicy {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private Set<String> administratorEmails = Set.of();

    public boolean isPlatformAdministrator(String email) {
        if (email == null) return false;
        try {
            return administratorEmails.contains(normalizeEmail(email));
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    public void requirePlatformAdministrator(Authentication actor) {
        if (actor == null || !actor.isAuthenticated() || !isPlatformAdministrator(actor.getName()))
            throw new AccessDeniedException("Platform administrator access is required");
    }

    public void setEmails(String emails) {
        if (emails == null || emails.isBlank()) {
            administratorEmails = Set.of();
            return;
        }
        Set<String> normalized = new LinkedHashSet<>();
        Arrays.stream(emails.split(",", -1)).map(PlatformAdminPolicy::normalizeEmail).forEach(normalized::add);
        administratorEmails = Set.copyOf(normalized);
    }

    public static String normalizeEmail(String email) {
        String normalized = email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(normalized).matches()) throw new IllegalArgumentException("Configured platform administrator contains an invalid email address");
        return normalized;
    }
}
