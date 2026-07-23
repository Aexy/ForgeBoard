package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.access.AccessDeniedException;

class PlatformAdminPolicyTest {
    @Test
    void normalizesConfiguredEmailsBeforeGrantingPlatformAdministration() {
        PlatformAdminPolicy policy = new PlatformAdminPolicy();
        policy.setEmails(" Owner@Example.com , second@example.com ");

        assertThat(policy.isPlatformAdministrator("owner@example.com")).isTrue();
        assertThat(policy.isPlatformAdministrator(" OWNER@EXAMPLE.COM ")).isTrue();
        assertThat(policy.isPlatformAdministrator("ordinary@example.com")).isFalse();
    }

    @Test
    void treatsAbsentOrBlankConfigurationAsNoPlatformAdministrators() {
        PlatformAdminPolicy policy = new PlatformAdminPolicy();

        assertThat(policy.isPlatformAdministrator("owner@example.com")).isFalse();
        policy.setEmails("   ");
        assertThat(policy.isPlatformAdministrator("owner@example.com")).isFalse();
    }

    @Test
    void rejectsMalformedConfiguredEmailEntries() {
        PlatformAdminPolicy policy = new PlatformAdminPolicy();

        assertThatThrownBy(() -> policy.setEmails("owner@example.com, not-an-email"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalid email address");
        assertThatThrownBy(() -> policy.setEmails("owner@example.com,"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalid email address");
    }

    @Test
    void requiresAnAuthenticatedConfiguredPlatformAdministrator() {
        PlatformAdminPolicy policy = new PlatformAdminPolicy();
        policy.setEmails("owner@example.com");

        policy.requirePlatformAdministrator(UsernamePasswordAuthenticationToken.authenticated(
                "owner@example.com", "n/a", java.util.List.of()));

        assertThatThrownBy(() -> policy.requirePlatformAdministrator(UsernamePasswordAuthenticationToken.authenticated(
                "ordinary@example.com", "n/a", java.util.List.of())))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> policy.requirePlatformAdministrator(null))
                .isInstanceOf(AccessDeniedException.class);
    }
}
