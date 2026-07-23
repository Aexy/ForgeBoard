package com.forgeboard.identity.persistence;

import java.util.Optional;
import java.util.List;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;

public interface FirmMembershipRepository extends JpaRepository<FirmMembership, UUID> {
    Optional<FirmMembership> findByFirmIdAndUserId(UUID firmId, UUID userId);
    boolean existsByFirmIdAndUserId(UUID firmId, UUID userId);
    List<FirmMembership> findAllByFirmIdOrderByCreatedAtAsc(UUID firmId);
    List<FirmMembership> findAllByFirmIdAndUserIdIn(UUID firmId, Collection<UUID> userIds);
    List<FirmMembership> findAllByUserId(UUID userId);
    long countByFirmIdAndRoleAndStatus(UUID firmId, MembershipRole role, MembershipStatus status);

    @Query("select new com.forgeboard.identity.persistence.FirmMembershipRepository$FirmStaffRow(" +
            "membership.id, user.id, user.displayName, user.email, membership.role, membership.status) " +
            "from FirmMembership membership join ForgeBoardUser user on user.id = membership.userId " +
            "where membership.firmId = :firmId and user.enabled = true order by membership.createdAt asc")
    List<FirmStaffRow> findStaffByFirmIdOrderByCreatedAtAsc(UUID firmId);

    record FirmStaffRow(UUID membershipId, UUID userId, String displayName, String email, MembershipRole role,
            MembershipStatus status) {
        /** Compatibility constructor for existing tenant employee projections. */
        public FirmStaffRow(UUID membershipId, UUID userId, String displayName, String email, MembershipRole role) {
            this(membershipId, userId, displayName, email, role, MembershipStatus.ACTIVE);
        }
    }
}
