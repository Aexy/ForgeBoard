package com.forgeboard.identity.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class AccessActionTest {
    @Test
    void acceptsOnlyCanonicalLowercaseHexSha256Digests() {
        AccessAction.TokenHash hash = new AccessAction.TokenHash("a".repeat(64));

        assertThat(hash.value()).isEqualTo("a".repeat(64));
        assertThatThrownBy(() -> new AccessAction.TokenHash("raw-invitation-token"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AccessAction.TokenHash("A".repeat(64)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
