package com.forgeboard.identity.persistence;

import java.util.Optional;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.forgeboard.identity.domain.AccessAction;
import com.forgeboard.identity.domain.AccessActionType;

import jakarta.persistence.LockModeType;

public interface AccessActionRepository extends JpaRepository<AccessAction, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select action from AccessAction action where action.tokenHash = :tokenHash")
    Optional<AccessAction> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<AccessAction> findFirstByTypeAndFirmIdAndTargetEmailAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
            AccessActionType type, UUID firmId, String targetEmail);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<AccessAction> findFirstByTypeAndUserIdAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
            AccessActionType type, UUID userId);

    Optional<AccessAction> findFirstByTypeAndFirmIdAndMembershipIdOrderByCreatedAtDesc(
            AccessActionType type, UUID firmId, UUID membershipId);

    Optional<AccessAction> findFirstByTypeAndFirmIdAndMembershipIdAndConsumedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
            AccessActionType type, UUID firmId, UUID membershipId);

    List<AccessAction> findAllByTypeAndFirmIdAndMembershipIdInOrderByCreatedAtAsc(AccessActionType type, UUID firmId,
            Collection<UUID> membershipIds);

    @Modifying(flushAutomatically = true)
    @Query(value = "insert into access_action_serialization_locks (lock_key, created_at) "
            + "values (:lockKey, current_timestamp) on conflict (lock_key) do nothing", nativeQuery = true)
    int createSerializationLock(@Param("lockKey") String lockKey);

    @Query(value = "select lock_key from access_action_serialization_locks where lock_key = :lockKey for update",
            nativeQuery = true)
    String lockSerializationKey(@Param("lockKey") String lockKey);
}
