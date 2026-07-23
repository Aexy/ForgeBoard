package com.forgeboard.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityNotFoundException;

import com.forgeboard.identity.application.PlatformAdministrationConflictException;
import com.forgeboard.identity.domain.ActivitySource;
import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.FirmStatus;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.domain.MembershipStatus;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

/** Purpose-built platform administration use cases. It intentionally never accesses tenant work data. */
@Service
public class PlatformAdministrationService {
    private static final int PAGE_SIZE = 50;
    private final PlatformAdminPolicy policy;
    private final FirmRepository firms;
    private final FirmMembershipRepository memberships;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final ActivityAuditService audit;
    private final Clock clock;

    public PlatformAdministrationService(PlatformAdminPolicy policy, FirmRepository firms,
            FirmMembershipRepository memberships, UserRepository users, PasswordEncoder passwords,
            ActivityAuditService audit, Clock clock) {
        this.policy = policy;
        this.firms = firms;
        this.memberships = memberships;
        this.users = users;
        this.passwords = passwords;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PlatformFirmPage listFirms(Authentication actor, String query, String cursor) {
        policy.requirePlatformAdministrator(actor);
        int page = parseCursor(cursor);
        String term = query == null ? "" : query.strip();
        var result = firms.findPlatformFirms(term, PageRequest.of(page, PAGE_SIZE));
        return new PlatformFirmPage(result.getContent().stream().map(row -> new PlatformFirmView(row.id(), row.name(),
                row.slug(), row.status(), row.createdAt(), row.employeeCount())).toList(),
                result.hasNext() ? Integer.toString(page + 1) : null);
    }

    @Transactional
    public PlatformFirmView createFirm(Authentication actor, CreatePlatformFirmRequest request) {
        policy.requirePlatformAdministrator(actor);
        String email = normalizeEmail(request.ownerEmail());
        String slug = OnboardingService.normalizeSlug(request.slug());
        if (users.existsByEmail(email)) throw new DuplicateIdentityException("Email is already registered");
        if (firms.existsBySlug(slug)) throw new DuplicateIdentityException("Firm slug is already registered");
        Instant now = clock.instant();
        Firm firm = firms.save(new Firm(UUID.randomUUID(), request.name().strip(), slug, now));
        ForgeBoardUser owner = users.save(new ForgeBoardUser(UUID.randomUUID(), email, request.ownerName().strip(),
                passwords.encode(request.initialPassword()), now));
        FirmMembership membership = memberships.save(new FirmMembership(UUID.randomUUID(), firm.id(), owner.id(),
                MembershipRole.OWNER, now));
        audit.recordUserAction(firm.id(), actorUserId(actor), ActivitySource.REST, "platform.firm.created", "firm",
                firm.id(), Map.of("firmSlug", firm.slug(), "initialOwnerMembershipId", membership.id().toString()));
        return firmView(firm);
    }

    @Transactional
    public PlatformFirmView suspendFirm(Authentication actor, UUID firmId) {
        policy.requirePlatformAdministrator(actor);
        Firm firm = firmForUpdate(firmId);
        firm.suspend(clock.instant());
        audit.recordUserAction(firm.id(), actorUserId(actor), ActivitySource.REST, "platform.firm.suspended", "firm",
                firm.id(), Map.of("status", FirmStatus.SUSPENDED.name()));
        return firmView(firm);
    }

    @Transactional
    public PlatformFirmView reactivateFirm(Authentication actor, UUID firmId) {
        policy.requirePlatformAdministrator(actor);
        Firm firm = firmForUpdate(firmId);
        firm.reactivate(clock.instant());
        audit.recordUserAction(firm.id(), actorUserId(actor), ActivitySource.REST, "platform.firm.reactivated", "firm",
                firm.id(), Map.of("status", FirmStatus.ACTIVE.name()));
        return firmView(firm);
    }

    @Transactional(readOnly = true)
    public List<PlatformEmployeeView> listEmployees(Authentication actor, UUID firmId) {
        policy.requirePlatformAdministrator(actor);
        requireFirm(firmId);
        return memberships.findStaffByFirmIdOrderByCreatedAtAsc(firmId).stream().map(row -> new PlatformEmployeeView(
                row.membershipId(), row.userId(), row.displayName(), row.email(), row.role(), row.status())).toList();
    }

    @Transactional
    public PlatformEmployeeView createEmployee(Authentication actor, UUID firmId, CreatePlatformEmployeeRequest request) {
        policy.requirePlatformAdministrator(actor);
        requireFirm(firmId);
        if (request.role() == MembershipRole.OWNER)
            throw new InvalidIdentityException("Employee provisioning cannot create an owner membership");
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) throw new DuplicateIdentityException("An account with this email already exists");
        Instant now = clock.instant();
        ForgeBoardUser user = users.save(new ForgeBoardUser(UUID.randomUUID(), email, request.displayName().strip(),
                passwords.encode(request.initialPassword()), now));
        FirmMembership membership = memberships.save(new FirmMembership(UUID.randomUUID(), firmId, user.id(), request.role(), now));
        audit.recordUserAction(firmId, actorUserId(actor), ActivitySource.REST, "platform.employee.provisioned", "membership",
                membership.id(), Map.of("employeeUserId", user.id().toString(), "role", membership.role().name()));
        return employeeView(membership, user);
    }

    @Transactional
    public PlatformEmployeeView updateRole(Authentication actor, UUID firmId, UUID membershipId,
            UpdateMembershipRoleRequest request) {
        policy.requirePlatformAdministrator(actor);
        lockFirmAndRequireIt(firmId);
        FirmMembership membership = membershipInFirm(firmId, membershipId, false);
        preventRemovingLastActiveOwner(membership, request.role(), membership.status());
        membership.changeRole(request.role(), clock.instant());
        ForgeBoardUser user = userFor(membership.userId());
        audit.recordUserAction(firmId, actorUserId(actor), ActivitySource.REST, "platform.employee.role-changed", "membership",
                membership.id(), Map.of("role", membership.role().name()));
        return employeeView(membership, user);
    }

    @Transactional
    public PlatformEmployeeView suspendMembership(Authentication actor, UUID firmId, UUID membershipId) {
        policy.requirePlatformAdministrator(actor);
        lockFirmAndRequireIt(firmId);
        FirmMembership membership = membershipInFirm(firmId, membershipId, false);
        preventRemovingLastActiveOwner(membership, membership.role(), MembershipStatus.SUSPENDED);
        membership.suspend(clock.instant());
        ForgeBoardUser user = userFor(membership.userId());
        audit.recordUserAction(firmId, actorUserId(actor), ActivitySource.REST, "platform.employee.suspended", "membership",
                membership.id(), Map.of("status", MembershipStatus.SUSPENDED.name()));
        return employeeView(membership, user);
    }

    @Transactional
    public PlatformEmployeeView reactivateMembership(Authentication actor, UUID firmId, UUID membershipId) {
        policy.requirePlatformAdministrator(actor);
        FirmMembership membership = membershipInFirm(firmId, membershipId, true);
        membership.reactivate(clock.instant());
        ForgeBoardUser user = userFor(membership.userId());
        audit.recordUserAction(firmId, actorUserId(actor), ActivitySource.REST, "platform.employee.reactivated", "membership",
                membership.id(), Map.of("status", MembershipStatus.ACTIVE.name()));
        return employeeView(membership, user);
    }

    private PlatformFirmView firmView(Firm firm) { return new PlatformFirmView(firm.id(), firm.name(), firm.slug(),
            firm.status(), firm.createdAt(), memberships.findAllByFirmIdOrderByCreatedAtAsc(firm.id()).size()); }

    private Firm firmForUpdate(UUID firmId) {
        return firms.findByIdForUpdate(firmId).orElseThrow(() -> new EntityNotFoundException("Firm was not found"));
    }

    private void requireFirm(UUID firmId) {
        if (!firms.existsById(firmId)) throw new EntityNotFoundException("Firm was not found");
    }

    private void lockFirmAndRequireIt(UUID firmId) { firmForUpdate(firmId); }

    private FirmMembership membershipInFirm(UUID firmId, UUID membershipId, boolean requireFirm) {
        if (requireFirm) requireFirm(firmId);
        return memberships.findById(membershipId).filter(membership -> membership.firmId().equals(firmId))
                .orElseThrow(() -> new EntityNotFoundException("Employee membership was not found"));
    }

    private ForgeBoardUser userFor(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new EntityNotFoundException("Employee account was not found"));
    }

    private void preventRemovingLastActiveOwner(FirmMembership current, MembershipRole requestedRole,
            MembershipStatus requestedStatus) {
        if (current.role() == MembershipRole.OWNER && current.status() == MembershipStatus.ACTIVE
                && (requestedRole != MembershipRole.OWNER || requestedStatus != MembershipStatus.ACTIVE)
                && memberships.countByFirmIdAndRoleAndStatus(current.firmId(), MembershipRole.OWNER,
                        MembershipStatus.ACTIVE) <= 1) {
            throw new PlatformAdministrationConflictException("A firm must retain at least one active owner");
        }
    }

    private UUID actorUserId(Authentication actor) {
        return users.findByEmail(normalizeEmail(actor.getName())).map(ForgeBoardUser::id)
                .orElseThrow(() -> new EntityNotFoundException("Platform administrator account was not found"));
    }

    private PlatformEmployeeView employeeView(FirmMembership membership, ForgeBoardUser user) {
        return new PlatformEmployeeView(membership.id(), user.id(), user.displayName(), user.email(), membership.role(), membership.status());
    }

    private static String normalizeEmail(String email) { return email.strip().toLowerCase(Locale.ROOT); }

    private static int parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            int page = Integer.parseInt(cursor);
            if (page < 0) throw new NumberFormatException();
            return page;
        } catch (NumberFormatException exception) {
            throw new InvalidIdentityException("Firm page cursor is invalid");
        }
    }
}
