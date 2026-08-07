package com.forgeboard.identity.application;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.identity.domain.AccessActionType;
import com.forgeboard.identity.domain.ActivitySource;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.persistence.AccessActionRepository;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

import jakarta.persistence.EntityNotFoundException;

/** Cross-firm support-only membership administration for configured platform administrators. */
@Service
public class PlatformAccessManagementService {
    private final PlatformAdminPolicy policy;
    private final FirmRepository firms;
    private final FirmMembershipRepository memberships;
    private final UserRepository users;
    private final AccessActionRepository actions;
    private final AccessLifecycleService lifecycle;
    private final ActivityAuditService audit;
    private final Clock clock;

    public PlatformAccessManagementService(PlatformAdminPolicy policy, FirmRepository firms,
            FirmMembershipRepository memberships, UserRepository users, AccessActionRepository actions,
            AccessLifecycleService lifecycle, ActivityAuditService audit, Clock clock) {
        this.policy = policy;
        this.firms = firms;
        this.memberships = memberships;
        this.users = users;
        this.actions = actions;
        this.lifecycle = lifecycle;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PlatformEmployeeView> list(Authentication actor, UUID firmId) {
        policy.requirePlatformAdministrator(actor);
        requireFirm(firmId);
        return views(firmId);
    }

    @Transactional
    public GeneratedAccessLink invite(Authentication actor, UUID firmId, InviteMemberRequest request) {
        UUID actorId = actorUserId(actor);
        lockFirm(firmId);
        return lifecycle.createInvitation(firmId, actorId, request);
    }

    @Transactional
    public GeneratedAccessLink reissueInvitation(Authentication actor, UUID firmId, UUID membershipId) {
        UUID actorId = actorUserId(actor);
        FirmMembership membership = membershipForMutation(firmId, membershipId);
        return lifecycle.reissueInvitation(firmId, actorId, membership.id());
    }

    @Transactional
    public void revokeInvitation(Authentication actor, UUID firmId, UUID membershipId) {
        UUID actorId = actorUserId(actor);
        FirmMembership membership = membershipForMutation(firmId, membershipId);
        lifecycle.revokeInvitation(firmId, actorId, membership.id());
    }

    @Transactional
    public PlatformEmployeeView updateRole(Authentication actor, UUID firmId, UUID membershipId,
            UpdateMembershipRoleRequest request) {
        UUID actorId = actorUserId(actor);
        FirmMembership membership = membershipForMutation(firmId, membershipId);
        preventRemovingLastActiveOwner(membership, request.role(), membership.status());
        membership.changeRole(request.role(), clock.instant());
        record(firmId, actorId, "platform.membership.role-changed", membership, Map.of("role", membership.role().name()));
        return view(membership, invitationEmails(firmId));
    }

    @Transactional
    public PlatformEmployeeView suspend(Authentication actor, UUID firmId, UUID membershipId) {
        UUID actorId = actorUserId(actor);
        FirmMembership membership = membershipForMutation(firmId, membershipId);
        requireBoundMembership(membership);
        preventRemovingLastActiveOwner(membership, membership.role(), MembershipStatus.SUSPENDED);
        membership.suspend(clock.instant());
        record(firmId, actorId, "platform.membership.suspended", membership, Map.of("status", membership.status().name()));
        return view(membership, invitationEmails(firmId));
    }

    @Transactional
    public PlatformEmployeeView reactivate(Authentication actor, UUID firmId, UUID membershipId) {
        UUID actorId = actorUserId(actor);
        FirmMembership membership = membershipForMutation(firmId, membershipId);
        requireBoundMembership(membership);
        requireReactivatable(membership);
        membership.reactivate(clock.instant());
        record(firmId, actorId, "platform.membership.reactivated", membership,
                Map.of("status", membership.status().name()));
        return view(membership, invitationEmails(firmId));
    }

    @Transactional
    public void remove(Authentication actor, UUID firmId, UUID membershipId) {
        UUID actorId = actorUserId(actor);
        FirmMembership membership = membershipForMutation(firmId, membershipId);
        requireBoundMembership(membership);
        preventRemovingLastActiveOwner(membership, membership.role(), MembershipStatus.REMOVED);
        membership.remove(clock.instant());
        record(firmId, actorId, "platform.membership.removed", membership, Map.of("status", membership.status().name()));
    }

    @Transactional
    public GeneratedAccessLink createPasswordReset(Authentication actor, UUID userId) {
        return lifecycle.createPasswordReset(actorUserId(actor), userId);
    }

    private UUID actorUserId(Authentication actor) {
        policy.requirePlatformAdministrator(actor);
        return users.findByEmail(PlatformAdminPolicy.normalizeEmail(actor.getName())).map(ForgeBoardUser::id)
                .orElseThrow(() -> new EntityNotFoundException("Platform administrator account was not found"));
    }

    private FirmMembership membershipForMutation(UUID firmId, UUID membershipId) {
        lockFirm(firmId);
        return memberships.findByIdAndFirmId(membershipId, firmId)
                .orElseThrow(() -> new EntityNotFoundException("Employee membership was not found"));
    }

    private void lockFirm(UUID firmId) {
        firms.findByIdForUpdate(firmId).orElseThrow(() -> new EntityNotFoundException("Firm was not found"));
    }

    private void requireFirm(UUID firmId) {
        if (!firms.existsById(firmId)) throw new EntityNotFoundException("Firm was not found");
    }

    private void requireBoundMembership(FirmMembership membership) {
        if (membership.userId() == null)
            throw new InvalidIdentityException("An invited membership must be managed through its invitation");
    }

    private void requireReactivatable(FirmMembership membership) {
        if (membership.status() == MembershipStatus.REMOVED)
            throw new InvalidIdentityException("A removed membership requires a new invitation");
    }

    private void preventRemovingLastActiveOwner(FirmMembership current, MembershipRole requestedRole,
            MembershipStatus requestedStatus) {
        if (current.role() == MembershipRole.OWNER && current.status() == MembershipStatus.ACTIVE
                && (requestedRole != MembershipRole.OWNER || requestedStatus != MembershipStatus.ACTIVE)
                && memberships.countByFirmIdAndRoleAndStatus(current.firmId(), MembershipRole.OWNER,
                        MembershipStatus.ACTIVE) <= 1)
            throw new PlatformAdministrationConflictException("A firm must retain at least one active owner");
    }

    private void record(UUID firmId, UUID actorId, String action, FirmMembership membership, Map<String, Object> summary) {
        audit.recordUserAction(firmId, actorId, ActivitySource.REST, action, "membership", membership.id(), summary);
    }

    private List<PlatformEmployeeView> views(UUID firmId) {
        List<FirmMembership> membershipsForFirm = memberships.findAllByFirmIdOrderByCreatedAtAsc(firmId);
        Map<UUID, String> invitationEmails = invitationEmails(firmId, membershipsForFirm);
        Map<UUID, ForgeBoardUser> usersById = users.findAllById(membershipsForFirm.stream()
                .map(FirmMembership::userId).filter(java.util.Objects::nonNull).toList()).stream()
                .collect(java.util.stream.Collectors.toMap(ForgeBoardUser::id, Function.identity()));
        return membershipsForFirm.stream().map(membership -> view(membership, invitationEmails, usersById)).toList();
    }

    private Map<UUID, String> invitationEmails(UUID firmId) {
        return invitationEmails(firmId, memberships.findAllByFirmIdOrderByCreatedAtAsc(firmId));
    }

    private Map<UUID, String> invitationEmails(UUID firmId, List<FirmMembership> membershipsForFirm) {
        List<UUID> membershipIds = membershipsForFirm.stream().map(FirmMembership::id).toList();
        if (membershipIds.isEmpty()) return Map.of();
        return actions.findAllByTypeAndFirmIdAndMembershipIdInOrderByCreatedAtAsc(AccessActionType.INVITATION, firmId, membershipIds)
                .stream().collect(java.util.stream.Collectors.toMap(action -> action.membershipId(), action -> action.targetEmail(),
                        (first, second) -> second));
    }

    private PlatformEmployeeView view(FirmMembership membership, Map<UUID, String> invitationEmails) {
        return view(membership, invitationEmails, null);
    }

    private PlatformEmployeeView view(FirmMembership membership, Map<UUID, String> invitationEmails,
            Map<UUID, ForgeBoardUser> usersById) {
        if (membership.userId() == null)
            return new PlatformEmployeeView(membership.id(), null, null, invitationEmails.get(membership.id()), membership.role(),
                    membership.status());
        ForgeBoardUser user = usersById == null ? users.findById(membership.userId())
                .orElseThrow(() -> new EntityNotFoundException("Employee account was not found"))
                : java.util.Optional.ofNullable(usersById.get(membership.userId()))
                        .orElseThrow(() -> new EntityNotFoundException("Employee account was not found"));
        return new PlatformEmployeeView(membership.id(), user.id(), user.displayName(), user.email(), membership.role(),
                membership.status());
    }
}
