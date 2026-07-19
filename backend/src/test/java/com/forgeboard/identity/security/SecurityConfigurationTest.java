package com.forgeboard.identity.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Base64;

import org.junit.jupiter.api.Test;

class SecurityConfigurationTest {
    private final SecurityConfiguration configuration = new SecurityConfiguration();

    @Test
    void rejectsBlankMalformedAndShortApiTokenSecrets() {
        assertThatThrownBy(() -> configuration.apiJwtEncoder(""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("FORGEBOARD_API_TOKEN_SECRET must be configured");
        assertThatThrownBy(() -> configuration.apiJwtEncoder("not-base64"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("FORGEBOARD_API_TOKEN_SECRET must be valid Base64");
        assertThatThrownBy(() -> configuration.apiJwtEncoder(Base64.getEncoder().encodeToString(new byte[31])))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("FORGEBOARD_API_TOKEN_SECRET must contain at least 256 bits");
    }

    @Test
    void acceptsA256BitBase64ApiTokenSecret() {
        String secret = Base64.getEncoder().encodeToString(new byte[32]);

        assertThatCode(() -> configuration.apiJwtEncoder(secret)).doesNotThrowAnyException();
        assertThatCode(() -> configuration.apiJwtDecoder(secret)).doesNotThrowAnyException();
    }
}
