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
    Optional<FirmMembership> findByIdAndFirmId(UUID id, UUID firmId);
    Optional<FirmMembership> findByFirmIdAndUserId(UUID firmId, UUID userId);
    Optional<FirmMembership> findByFirmIdAndInvitationEmailAndStatus(UUID firmId, String invitationEmail,
            MembershipStatus status);
    boolean existsByFirmIdAndUserId(UUID firmId, UUID userId);
    List<FirmMembership> findAllByFirmIdOrderByCreatedAtAsc(UUID firmId);
    List<FirmMembership> findAllByFirmIdAndUserIdIn(UUID firmId, Collection<UUID> userIds);
    List<FirmMembership> findAllByUserId(UUID userId);
    long countByFirmIdAndRoleAndStatus(UUID firmId, MembershipRole role, MembershipStatus status);

    @Query("select (count(membership) > 0) from FirmMembership membership " +
            "join ForgeBoardUser user on user.id = membership.userId " +
            "where membership.firmId = :firmId and membership.userId = :userId " +
            "and membership.status = com.forgeboard.identity.domain.MembershipStatus.ACTIVE and user.enabled = true")
    boolean existsActiveEnabledByFirmIdAndUserId(UUID firmId, UUID userId);

    @Query("select new com.forgeboard.identity.persistence.FirmMembershipRepository$FirmStaffRow(" +
            "membership.id, user.id, user.displayName, user.email, membership.role, membership.status) " +
            "from FirmMembership membership join ForgeBoardUser user on user.id = membership.userId " +
            "where membership.firmId = :firmId " +
            "and membership.status = com.forgeboard.identity.domain.MembershipStatus.ACTIVE " +
            "and user.enabled = true order by membership.createdAt asc")
    List<FirmStaffRow> findStaffByFirmIdOrderByCreatedAtAsc(UUID firmId);

    @Query("select new com.forgeboard.identity.persistence.FirmMembershipRepository$FirmStaffRow(" +
            "membership.id, user.id, user.displayName, user.email, membership.role, membership.status) " +
            "from FirmMembership membership join ForgeBoardUser user on user.id = membership.userId " +
            "where membership.firmId = :firmId and user.id in :userIds " +
            "and membership.status = com.forgeboard.identity.domain.MembershipStatus.ACTIVE " +
            "and user.enabled = true order by membership.createdAt asc")
    List<FirmStaffRow> findActiveStaffByFirmIdAndUserIdIn(UUID firmId, Collection<UUID> userIds);

    record FirmStaffRow(UUID membershipId, UUID userId, String displayName, String email, MembershipRole role,
            MembershipStatus status) {
        /** Compatibility constructor for existing tenant employee projections. */
        public FirmStaffRow(UUID membershipId, UUID userId, String displayName, String email, MembershipRole role) {
            this(membershipId, userId, displayName, email, role, MembershipStatus.ACTIVE);
        }
    }
}
