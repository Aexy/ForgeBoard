package com.forgeboard.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.identity.domain.ActivitySource;
import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.FirmStatus;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

import jakarta.persistence.EntityNotFoundException;

/** Firm lifecycle use cases for the platform-administration boundary. */
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

    private PlatformFirmView firmView(Firm firm) {
        return new PlatformFirmView(firm.id(), firm.name(), firm.slug(), firm.status(), firm.createdAt(),
                memberships.findAllByFirmIdOrderByCreatedAtAsc(firm.id()).size());
    }

    private Firm firmForUpdate(UUID firmId) {
        return firms.findByIdForUpdate(firmId).orElseThrow(() -> new EntityNotFoundException("Firm was not found"));
    }

    private UUID actorUserId(Authentication actor) {
        return users.findByEmail(normalizeEmail(actor.getName())).map(ForgeBoardUser::id)
                .orElseThrow(() -> new EntityNotFoundException("Platform administrator account was not found"));
    }

    private static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

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
