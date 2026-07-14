package com.forgeboard.identity.application;

import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.UserRepository;

@Service
public class EmployeeProvisioningService {
    private final TenantAuthorizationService policy;
    private final UserRepository users;
    private final FirmMembershipRepository memberships;
    private final PasswordEncoder passwordEncoder;
    private final ActivityRecorder activity;
    private final Clock clock;

    public EmployeeProvisioningService(TenantAuthorizationService policy, UserRepository users,
            FirmMembershipRepository memberships, PasswordEncoder passwordEncoder,
            ActivityRecorder activity, Clock clock) {
        this.policy = policy; this.users = users; this.memberships = memberships;
        this.passwordEncoder = passwordEncoder; this.activity = activity; this.clock = clock;
    }

    @Transactional
    public EmployeeView create(SelectedTenant actor, CreateEmployeeRequest request) {
        policy.requireMembershipManagement(actor);
        if (request.role() == com.forgeboard.identity.domain.MembershipRole.OWNER)
            throw new IllegalArgumentException("Employee provisioning cannot create an owner membership");
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        ForgeBoardUser user = users.findByEmail(email).orElseGet(() -> users.save(new ForgeBoardUser(
                UUID.randomUUID(), email, request.displayName().strip(),
                passwordEncoder.encode(request.temporaryPassword()), clock.instant())));
        if (memberships.existsByFirmIdAndUserId(actor.firmId(), user.id()))
            throw new DuplicateIdentityException("Employee already belongs to this firm");
        FirmMembership membership = memberships.save(new FirmMembership(UUID.randomUUID(), actor.firmId(), user.id(),
                request.role(), clock.instant()));
        activity.recordRestUserAction(actor.firmId(), actor.userId(), "employee.created", "membership", membership.id(),
                Map.of("employeeUserId", user.id().toString(), "role", request.role().name()));
        return view(membership, user);
    }

    @Transactional(readOnly = true)
    public List<EmployeeView> list(SelectedTenant actor) {
        policy.requireMembershipManagement(actor);
        return memberships.findAllByFirmIdOrderByCreatedAtAsc(actor.firmId()).stream()
                .map(membership -> users.findById(membership.userId()).map(user -> view(membership, user)))
                .flatMap(java.util.Optional::stream).toList();
    }

    private EmployeeView view(FirmMembership membership, ForgeBoardUser user) {
        return new EmployeeView(membership.id(), user.id(), user.displayName(), user.email(), membership.role());
    }
}
