package com.forgeboard.identity.bootstrap;

import java.time.Clock;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.forgeboard.identity.application.PlatformAdminPolicy;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.persistence.UserRepository;

/**
 * Operational, explicitly enabled bootstrap for the first standalone platform user.
 * The separate platform-admin email policy grants the resulting user any authority.
 */
@Component
@ConfigurationProperties(prefix = "forgeboard.platform-admin.bootstrap")
public class PlatformAdminBootstrapRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(PlatformAdminBootstrapRunner.class);

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final Clock clock;
    private boolean enabled;
    private String email;
    private String initialPassword;

    public PlatformAdminBootstrapRunner(UserRepository users, PasswordEncoder passwords, Clock clock) {
        this.users = users;
        this.passwords = passwords;
        this.clock = clock;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        if (!enabled) return;
        String normalizedEmail = PlatformAdminPolicy.normalizeEmail(email);
        if (initialPassword == null || initialPassword.isBlank())
            throw new IllegalStateException("Platform administrator bootstrap initial password is required");
        if (users.existsByEmail(normalizedEmail))
            throw new IllegalStateException("Platform administrator bootstrap user already exists");

        users.save(new ForgeBoardUser(UUID.randomUUID(), normalizedEmail, "Platform administrator",
                passwords.encode(initialPassword), clock.instant()));
        log.info("Platform administrator bootstrap completed; disable bootstrap configuration before the next startup");
    }

    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public void setEmail(String email) { this.email = email; }
    public void setInitialPassword(String initialPassword) { this.initialPassword = initialPassword; }
}
