package com.forgeboard.identity.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

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
        ArgumentCaptor<ApiRefreshToken> saved = ArgumentCaptor.forClass(ApiRefreshToken.class);
        verify(refreshTokens).save(saved.capture());
        assertThat(saved.getValue().expiresAt()).isEqualTo(token.expiresAt());
        assertThat(rotated.sessionExpiresAt()).isEqualTo(token.expiresAt());
        assertThatThrownBy(() -> service.refresh("opaque-refresh-token"))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid API credentials");
        verify(refreshTokens).revokeFamily(familyId, clock.instant());
    }

    @Test
    void revokesEveryRefreshFamilyForAUser() {
        UUID userId = UUID.randomUUID();

        service().revokeAllForUser(userId);

        verify(refreshTokens).revokeAllForUser(userId, clock.instant());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(booleans = {false, true})
    void selectsAnAbsoluteSessionDeadlineForEachRememberChoice(Boolean remember) {
        ForgeBoardUser user = new ForgeBoardUser(UUID.randomUUID(), "owner@example.com", "Owner", "hash", clock.instant());
        when(authenticationManager.authenticate(any())).thenReturn(
                UsernamePasswordAuthenticationToken.authenticated(user.email(), null, List.of()));
        when(users.findByEmail(user.email())).thenReturn(Optional.of(user));
        stubIssue(user);

        ApiTokenService.ApiGrant grant = service().grant(new SessionLoginRequest(user.email(), "password", remember));

        Instant expected = Boolean.FALSE.equals(remember) ? clock.instant().plus(12, ChronoUnit.HOURS)
                : clock.instant().plus(30, ChronoUnit.DAYS);
        ArgumentCaptor<ApiRefreshToken> saved = ArgumentCaptor.forClass(ApiRefreshToken.class);
        verify(refreshTokens).save(saved.capture());
        assertThat(saved.getValue().expiresAt()).isEqualTo(expected);
        assertThat(grant.sessionExpiresAt()).isEqualTo(expected);
        assertThat(grant.accessTokenExpiresAt()).isEqualTo(clock.instant().plus(15, ChronoUnit.MINUTES));
    }

    @Test
    void capsAccessExpiryWhenRotatingJustBeforeTheSessionDeadline() {
        ForgeBoardUser user = new ForgeBoardUser(UUID.randomUUID(), "owner@example.com", "Owner", "hash", clock.instant());
        Instant deadline = clock.instant().plusSeconds(60);
        ApiRefreshToken token = new ApiRefreshToken(UUID.randomUUID(), user.id(), UUID.randomUUID(), "hash",
                UUID.randomUUID(), deadline, clock.instant().minusSeconds(3600));
        when(refreshTokens.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(users.findById(user.id())).thenReturn(Optional.of(user));
        stubIssue(user);

        ApiTokenService.ApiGrant rotated = service().refresh("opaque-refresh-token");

        ArgumentCaptor<JwtEncoderParameters> claims = ArgumentCaptor.forClass(JwtEncoderParameters.class);
        verify(jwtEncoder).encode(claims.capture());
        assertThat(claims.getValue().getClaims().getExpiresAt()).isEqualTo(deadline);
        assertThat(rotated.accessTokenExpiresAt()).isEqualTo(deadline);
        assertThat(rotated.sessionExpiresAt()).isEqualTo(deadline);
    }

    @Test
    void rejectsRefreshAtTheExactDeadlineWithoutIssuingTokens() {
        ApiRefreshToken token = new ApiRefreshToken(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "hash",
                UUID.randomUUID(), clock.instant(), clock.instant().minusSeconds(3600));
        when(refreshTokens.findByTokenHash(anyString())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service().refresh("expired-refresh-token")).isInstanceOf(BadCredentialsException.class);

        assertThat(token.usedAt()).isNull();
        verify(refreshTokens, never()).save(any());
    }

    @Test
    void rejectsRevokedRefreshTokens() {
        ApiRefreshToken token = new ApiRefreshToken(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "hash",
                UUID.randomUUID(), clock.instant().plusSeconds(3600), clock.instant());
        token.revoke(clock.instant());
        when(refreshTokens.findByTokenHash(anyString())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service().refresh("revoked-refresh-token")).isInstanceOf(BadCredentialsException.class);

        verify(refreshTokens, never()).save(any());
    }

    @Test
    void rejectsRefreshForADisabledUser() {
        ForgeBoardUser user = org.mockito.Mockito.mock(ForgeBoardUser.class);
        UUID userId = UUID.randomUUID();
        ApiRefreshToken token = new ApiRefreshToken(UUID.randomUUID(), userId, UUID.randomUUID(), "hash",
                UUID.randomUUID(), clock.instant().plusSeconds(3600), clock.instant());
        when(refreshTokens.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(users.findById(userId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service().refresh("disabled-user-refresh-token")).isInstanceOf(BadCredentialsException.class);

        verify(refreshTokens, never()).save(any());
    }

    @Test
    void signOutRevokesTheTokenFamily() {
        UUID familyId = UUID.randomUUID();
        ApiRefreshToken token = new ApiRefreshToken(UUID.randomUUID(), UUID.randomUUID(), familyId, "hash",
                UUID.randomUUID(), clock.instant().plusSeconds(3600), clock.instant());
        when(refreshTokens.findByTokenHash(anyString())).thenReturn(Optional.of(token));

        service().revoke("opaque-refresh-token");

        verify(refreshTokens).revokeFamily(familyId, clock.instant());
    }

    private void stubIssue(ForgeBoardUser user) {
        when(firmAccess.list(user.email())).thenReturn(List.of());
        when(platformAdmins.isPlatformAdministrator(user.email())).thenReturn(true);
        when(jwtEncoder.encode(any())).thenReturn(Jwt.withTokenValue("signed-access-token").header("alg", "HS256")
                .claim("sub", user.email()).build());
    }

    private ApiTokenService service() {
        return new ApiTokenService(authenticationManager, jwtEncoder, refreshTokens, users, firmAccess, platformAdmins, clock);
    }
}
