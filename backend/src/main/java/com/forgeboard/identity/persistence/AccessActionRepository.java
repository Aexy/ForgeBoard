package com.forgeboard.identity.persistence;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.forgeboard.identity.domain.AccessAction;

import jakarta.persistence.LockModeType;

public interface AccessActionRepository extends JpaRepository<AccessAction, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select action from AccessAction action where action.tokenHash = :tokenHash")
    Optional<AccessAction> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);
}
