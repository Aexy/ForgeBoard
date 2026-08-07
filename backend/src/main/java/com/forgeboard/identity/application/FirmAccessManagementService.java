package com.forgeboard.identity.application;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.identity.SelectedTenant;
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

/** Tenant-scoped membership administration backed by the shared one-time access lifecycle. */
@Service
public class FirmAccessManagementService {
    private final TenantAuthorizationService policy;
    private final FirmRepository firms;
    private final FirmMembershipRepository memberships;
    private final UserRepository users;
    private final AccessActionRepository actions;
    private final AccessLifecycleService lifecycle;
    private final ActivityAuditService audit;
    private final Clock clock;

    public FirmAccessManagementService(TenantAuthorizationService policy, FirmRepository firms,
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
    public List<EmployeeView> list(SelectedTenant actor) {
        policy.requireMembershipManagement(actor);
        return views(actor.firmId());
    }

    @Transactional
    public GeneratedAccessLink invite(SelectedTenant actor, InviteMemberRequest request) {
        policy.requireMembershipManagement(actor);
        requireRoleManagement(actor, request.role());
        lockFirm(actor.firmId());
        return lifecycle.createInvitation(actor.firmId(), actor.userId(), request);
    }

    @Transactional
    public GeneratedAccessLink reissueInvitation(SelectedTenant actor, UUID membershipId) {
        FirmMembership membership = membershipForMutation(actor, membershipId);
        requireRoleManagement(actor, membership.role());
        return lifecycle.reissueInvitation(actor.firmId(), actor.userId(), membership.id());
    }

    @Transactional
    public void revokeInvitation(SelectedTenant actor, UUID membershipId) {
        FirmMembership membership = membershipForMutation(actor, membershipId);
        requireRoleManagement(actor, membership.role());
        lifecycle.revokeInvitation(actor.firmId(), actor.userId(), membership.id());
    }

    @Transactional
    public EmployeeView updateRole(SelectedTenant actor, UUID membershipId, UpdateMembershipRoleRequest request) {
        FirmMembership membership = membershipForMutation(actor, membershipId);
        requireRoleManagement(actor, membership.role());
        requireRoleManagement(actor, request.role());
        preventRemovingLastActiveOwner(membership, request.role(), membership.status());
        membership.changeRole(request.role(), clock.instant());
        record(actor, "membership.role-changed", membership, Map.of("role", membership.role().name()));
        return view(membership, invitationEmails(actor.firmId()));
    }

    @Transactional
    public EmployeeView suspend(SelectedTenant actor, UUID membershipId) {
        FirmMembership membership = membershipForMutation(actor, membershipId);
        requireRoleManagement(actor, membership.role());
        requireBoundMembership(membership);
        preventRemovingLastActiveOwner(membership, membership.role(), MembershipStatus.SUSPENDED);
        membership.suspend(clock.instant());
        record(actor, "membership.suspended", membership, Map.of("status", membership.status().name()));
        return view(membership, invitationEmails(actor.firmId()));
    }

    @Transactional
    public EmployeeView reactivate(SelectedTenant actor, UUID membershipId) {
        FirmMembership membership = membershipForMutation(actor, membershipId);
        requireRoleManagement(actor, membership.role());
        requireBoundMembership(membership);
        requireReactivatable(membership);
        membership.reactivate(clock.instant());
        record(actor, "membership.reactivated", membership, Map.of("status", membership.status().name()));
        return view(membership, invitationEmails(actor.firmId()));
    }

    @Transactional
    public void remove(SelectedTenant actor, UUID membershipId) {
        FirmMembership membership = membershipForMutation(actor, membershipId);
        requireRoleManagement(actor, membership.role());
        requireBoundMembership(membership);
        preventRemovingLastActiveOwner(membership, membership.role(), MembershipStatus.REMOVED);
        membership.remove(clock.instant());
        record(actor, "membership.removed", membership, Map.of("status", membership.status().name()));
    }

    private FirmMembership membershipForMutation(SelectedTenant actor, UUID membershipId) {
        policy.requireMembershipManagement(actor);
        lockFirm(actor.firmId());
        return memberships.findByIdAndFirmId(membershipId, actor.firmId())
                .orElseThrow(() -> new EntityNotFoundException("Employee membership was not found"));
    }

    private void lockFirm(UUID firmId) {
        firms.findByIdForUpdate(firmId).orElseThrow(() -> new EntityNotFoundException("Firm was not found"));
    }

    private void requireRoleManagement(SelectedTenant actor, MembershipRole role) {
        if (actor.role() != MembershipRole.OWNER && role == MembershipRole.OWNER)
            throw new AccessDeniedException("Only owners can manage owner memberships");
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

    private void record(SelectedTenant actor, String action, FirmMembership membership, Map<String, Object> summary) {
        audit.recordUserAction(actor.firmId(), actor.userId(), ActivitySource.REST, action, "membership", membership.id(), summary);
    }

    private List<EmployeeView> views(UUID firmId) {
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
        return actions.findAllByTypeAndFirmIdAndMembershipIdInOrderByCreatedAtAsc(AccessActionType.INVITATION, firmId, membershipIds).stream()
                .collect(java.util.stream.Collectors.toMap(action -> action.membershipId(), action -> action.targetEmail(),
                        (first, second) -> second));
    }

    private EmployeeView view(FirmMembership membership, Map<UUID, String> invitationEmails) {
        return view(membership, invitationEmails, null);
    }

    private EmployeeView view(FirmMembership membership, Map<UUID, String> invitationEmails,
            Map<UUID, ForgeBoardUser> usersById) {
        if (membership.userId() == null)
            return new EmployeeView(membership.id(), null, null, invitationEmails.get(membership.id()), membership.role(),
                    membership.status());
        ForgeBoardUser user = usersById == null ? users.findById(membership.userId())
                .orElseThrow(() -> new EntityNotFoundException("Employee account was not found"))
                : java.util.Optional.ofNullable(usersById.get(membership.userId()))
                        .orElseThrow(() -> new EntityNotFoundException("Employee account was not found"));
        return new EmployeeView(membership.id(), user.id(), user.displayName(), user.email(), membership.role(), membership.status());
    }
}
