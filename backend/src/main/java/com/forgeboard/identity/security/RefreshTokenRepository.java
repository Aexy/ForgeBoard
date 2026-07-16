package com.forgeboard.identity.security;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.forgeboard.identity.domain.ApiRefreshToken;

import jakarta.persistence.LockModeType;

public interface RefreshTokenRepository extends JpaRepository<ApiRefreshToken, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ApiRefreshToken> findByTokenHash(String tokenHash);

    @Query("select count(token) > 0 from ApiRefreshToken token where token.accessTokenJti = :jti "
            + "and token.revokedAt is null and token.expiresAt > :now")
    boolean hasActiveAccessToken(@Param("jti") UUID jti, @Param("now") Instant now);

    @Modifying(flushAutomatically = true)
    @Query("update ApiRefreshToken token set token.revokedAt = :now where token.familyId = :familyId "
            + "and token.revokedAt is null")
    int revokeFamily(@Param("familyId") UUID familyId, @Param("now") Instant now);
}
