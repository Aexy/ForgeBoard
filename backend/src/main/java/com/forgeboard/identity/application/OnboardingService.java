package com.forgeboard.identity.application;

import java.text.Normalizer;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.ActivitySource;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@Service
public class OnboardingService {
    private final FirmRepository firms;
    private final UserRepository users;
    private final FirmMembershipRepository memberships;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final ActivityAuditService audit;

    public OnboardingService(FirmRepository firms, UserRepository users,
            FirmMembershipRepository memberships, PasswordEncoder passwordEncoder, Clock clock,
            ActivityAuditService audit) {
        this.firms = firms;
        this.users = users;
        this.memberships = memberships;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.audit = audit;
    }

    @Transactional
    public OnboardingResult createFirm(OnboardingRequest request) {
        String email = request.ownerEmail().strip().toLowerCase(Locale.ROOT);
        String slug = normalizeSlug(request.firmSlug());
        if (users.existsByEmail(email)) throw new DuplicateIdentityException("Email is already registered");
        if (firms.existsBySlug(slug)) throw new DuplicateIdentityException("Firm slug is already registered");

        Instant now = clock.instant();
        Firm firm = new Firm(UUID.randomUUID(), request.firmName().strip(), slug, now);
        ForgeBoardUser owner = new ForgeBoardUser(UUID.randomUUID(), email, request.ownerName().strip(),
                passwordEncoder.encode(request.password()), now);
        firms.save(firm);
        users.save(owner);
        memberships.save(new FirmMembership(UUID.randomUUID(), firm.id(), owner.id(), MembershipRole.OWNER, now));
        audit.recordUserAction(firm.id(), owner.id(), ActivitySource.REST, "firm.created", "firm", firm.id(),
                java.util.Map.of("firmName", firm.name(), "firmSlug", firm.slug()));
        return new OnboardingResult(firm.id(), firm.slug(), owner.id(), owner.email());
    }

    static String normalizeSlug(String candidate) {
        String slug = Normalizer.normalize(candidate.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFKD)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (slug.length() < 3) throw new InvalidIdentityException("Firm slug must contain at least three letters or numbers");
        return slug;
    }
}
