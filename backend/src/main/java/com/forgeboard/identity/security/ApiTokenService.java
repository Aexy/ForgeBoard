package com.forgeboard.identity.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.identity.application.FirmAccessService;
import com.forgeboard.identity.application.FirmAccessView;
import com.forgeboard.identity.application.PlatformAdminPolicy;
import com.forgeboard.identity.application.SessionIdentity;
import com.forgeboard.identity.application.SessionLoginRequest;
import com.forgeboard.identity.domain.ApiRefreshToken;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.persistence.UserRepository;

@Service
public class ApiTokenService {
    private static final String ISSUER = "forgeboard";
    private static final String AUDIENCE = "forgeboard-api";
    private static final long ACCESS_TOKEN_MINUTES = 15;
    private static final long REFRESH_TOKEN_DAYS = 30;

    private final AuthenticationManager authenticationManager;
    private final JwtEncoder jwtEncoder;
    private final RefreshTokenRepository refreshTokens;
    private final UserRepository users;
    private final FirmAccessService firmAccess;
    private final PlatformAdminPolicy platformAdmins;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public ApiTokenService(AuthenticationManager authenticationManager, JwtEncoder jwtEncoder,
            RefreshTokenRepository refreshTokens, UserRepository users, FirmAccessService firmAccess,
            PlatformAdminPolicy platformAdmins, Clock clock) {
        this.authenticationManager = authenticationManager;
        this.jwtEncoder = jwtEncoder;
        this.refreshTokens = refreshTokens;
        this.users = users;
        this.firmAccess = firmAccess;
        this.platformAdmins = platformAdmins;
        this.clock = clock;
    }

    @Transactional
    public ApiGrant grant(SessionLoginRequest credentials) {
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(credentials.email(), credentials.password()));
        ForgeBoardUser user = activeUser(authentication.getName());
        return issue(user, UUID.randomUUID());
    }

    @Transactional(noRollbackFor = BadCredentialsException.class)
    public ApiGrant refresh(String refreshToken) {
        Instant now = clock.instant();
        ApiRefreshToken existing = refreshTokens.findByTokenHash(hash(refreshToken))
                .orElseThrow(this::invalidGrant);
        if (existing.usedAt() != null) {
            refreshTokens.revokeFamily(existing.familyId(), now);
            throw invalidGrant();
        }
        if (existing.revokedAt() != null || existing.isExpired(now)) throw invalidGrant();
        existing.markUsed(now);
        return issue(activeUser(existing.userId()), existing.familyId());
    }

    @Transactional
    public void revoke(String refreshToken) {
        refreshTokens.findByTokenHash(hash(refreshToken))
                .ifPresent(token -> refreshTokens.revokeFamily(token.familyId(), clock.instant()));
    }

    @Transactional(readOnly = true)
    public boolean isAccessTokenActive(UUID jti) {
        return refreshTokens.hasActiveAccessToken(jti, clock.instant());
    }

    private ApiGrant issue(ForgeBoardUser user, UUID familyId) {
        Instant now = clock.instant();
        Instant accessExpiry = now.plus(ACCESS_TOKEN_MINUTES, ChronoUnit.MINUTES);
        UUID jti = UUID.randomUUID();
        String refreshToken = newRefreshToken();
        refreshTokens.save(new ApiRefreshToken(UUID.randomUUID(), user.id(), familyId, hash(refreshToken), jti,
                now.plus(REFRESH_TOKEN_DAYS, ChronoUnit.DAYS), now));
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer(ISSUER).audience(List.of(AUDIENCE)).subject(user.email())
                .issuedAt(now).expiresAt(accessExpiry).id(jti.toString()).claim("user_id", user.id().toString()).build();
        return new ApiGrant(jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue(), accessExpiry,
                refreshToken, new SessionIdentity(user.email()), firmAccess.list(user.email()),
                platformAdmins.isPlatformAdministrator(user.email()));
    }

    private ForgeBoardUser activeUser(String email) {
        return users.findByEmail(email.toLowerCase(Locale.ROOT)).filter(ForgeBoardUser::enabled)
                .orElseThrow(this::invalidGrant);
    }

    private ForgeBoardUser activeUser(UUID userId) {
        return users.findById(userId).filter(ForgeBoardUser::enabled).orElseThrow(this::invalidGrant);
    }

    private String newRefreshToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String token) {
        try {
            return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private BadCredentialsException invalidGrant() { return new BadCredentialsException("Invalid API credentials"); }

    public record ApiGrant(String accessToken, Instant accessTokenExpiresAt, String refreshToken,
            SessionIdentity identity, List<FirmAccessView> firms, boolean platformAdministrator) { }
}
