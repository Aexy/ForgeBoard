package com.forgeboard.identity.persistence;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.identity.domain.FirmMembership;

public interface FirmMembershipRepository extends JpaRepository<FirmMembership, UUID> {
    Optional<FirmMembership> findByFirmIdAndUserId(UUID firmId, UUID userId);
    boolean existsByFirmIdAndUserId(UUID firmId, UUID userId);
    List<FirmMembership> findAllByFirmIdOrderByCreatedAtAsc(UUID firmId);
    List<FirmMembership> findAllByUserId(UUID userId);
}
