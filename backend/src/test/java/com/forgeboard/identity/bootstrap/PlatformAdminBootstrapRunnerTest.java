package com.forgeboard.identity.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class PlatformAdminBootstrapRunnerTest {
    @Mock UserRepository users;
    @Mock PasswordEncoder passwords;
    private final Clock clock = Clock.fixed(Instant.parse("2026-07-23T12:00:00Z"), ZoneOffset.UTC);

    @Test
    void createsOnlyAStandalonePasswordHashedUserWhenExplicitlyEnabled() throws Exception {
        PlatformAdminBootstrapRunner runner = runner();
        runner.setEnabled(true);
        runner.setEmail(" Owner@Example.com ");
        runner.setInitialPassword("correct horse battery");
        when(users.existsByEmail("owner@example.com")).thenReturn(false);
        when(passwords.encode("correct horse battery")).thenReturn("bcrypt-hash");

        runner.run(new DefaultApplicationArguments());

        ArgumentCaptor<ForgeBoardUser> saved = ArgumentCaptor.forClass(ForgeBoardUser.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue().email()).isEqualTo("owner@example.com");
        assertThat(saved.getValue().displayName()).isEqualTo("Platform administrator");
        assertThat(saved.getValue().passwordHash()).isEqualTo("bcrypt-hash");
    }

    @Test
    void refusesToOverwriteAnExistingUserWithoutEncodingOrSaving() {
        PlatformAdminBootstrapRunner runner = runner();
        runner.setEnabled(true);
        runner.setEmail("owner@example.com");
        runner.setInitialPassword("correct horse battery");
        when(users.existsByEmail("owner@example.com")).thenReturn(true);

        assertThatThrownBy(() -> runner.run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Platform administrator bootstrap user already exists");
        verify(passwords, never()).encode(any());
        verify(users, never()).save(any());
    }

    @Test
    void doesNothingWhenDisabled() throws Exception {
        PlatformAdminBootstrapRunner runner = runner();

        runner.run(new DefaultApplicationArguments());

        verify(users, never()).existsByEmail(any());
        verify(users, never()).save(any());
    }

    private PlatformAdminBootstrapRunner runner() {
        return new PlatformAdminBootstrapRunner(users, passwords, clock);
    }
}
