package com.forgeboard.identity.persistence;

import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.identity.domain.Firm;

public interface FirmRepository extends JpaRepository<Firm, UUID> {
    boolean existsBySlug(String slug);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select firm from Firm firm where firm.id = :firmId")
    Optional<Firm> findByIdForUpdate(UUID firmId);
}
