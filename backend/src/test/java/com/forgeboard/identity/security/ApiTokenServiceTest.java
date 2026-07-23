package com.forgeboard.identity.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;

import com.forgeboard.identity.application.FirmAccessService;
import com.forgeboard.identity.application.PlatformAdminPolicy;
import com.forgeboard.identity.application.SessionLoginRequest;
import com.forgeboard.identity.domain.ApiRefreshToken;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class ApiTokenServiceTest {
    @Mock AuthenticationManager authenticationManager;
    @Mock JwtEncoder jwtEncoder;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock UserRepository users;
    @Mock FirmAccessService firmAccess;
    @Mock PlatformAdminPolicy platformAdmins;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-16T12:00:00Z"), ZoneOffset.UTC);

    @Test
    void rejectsInvalidCredentialsWithoutIssuingTokens() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));
        ApiTokenService service = service();

        assertThatThrownBy(() -> service.grant(new SessionLoginRequest("owner@example.com", "bad password")))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void rotatesRefreshOnceAndRevokesItsFamilyOnReplay() {
        UUID userId = UUID.randomUUID();
        UUID familyId = UUID.randomUUID();
        ApiRefreshToken token = new ApiRefreshToken(UUID.randomUUID(), userId, familyId, "not-plaintext", UUID.randomUUID(),
                clock.instant().plusSeconds(3600), clock.instant());
        ForgeBoardUser user = new ForgeBoardUser(userId, "owner@example.com", "Owner", "hash", clock.instant());
        when(refreshTokens.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(firmAccess.list(user.email())).thenReturn(List.of());
        when(platformAdmins.isPlatformAdministrator(user.email())).thenReturn(true);
        when(jwtEncoder.encode(any())).thenReturn(Jwt.withTokenValue("signed-access-token").header("alg", "HS256")
                .claim("sub", user.email()).build());
        ApiTokenService service = service();

        ApiTokenService.ApiGrant rotated = service.refresh("opaque-refresh-token");

        assertThat(rotated.refreshToken()).isNotEqualTo("opaque-refresh-token");
        assertThat(rotated.accessToken()).isEqualTo("signed-access-token");
        assertThat(rotated.platformAdministrator()).isTrue();
        verify(refreshTokens).save(any(ApiRefreshToken.class));
        assertThatThrownBy(() -> service.refresh("opaque-refresh-token"))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid API credentials");
        verify(refreshTokens).revokeFamily(familyId, clock.instant());
    }

    private ApiTokenService service() {
        return new ApiTokenService(authenticationManager, jwtEncoder, refreshTokens, users, firmAccess, platformAdmins, clock);
    }
}
