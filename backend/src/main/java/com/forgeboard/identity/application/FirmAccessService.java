package com.forgeboard.identity.application;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@Service
public class FirmAccessService {
    private final UserRepository users;
    private final FirmMembershipRepository memberships;
    private final FirmRepository firms;

    public FirmAccessService(UserRepository users, FirmMembershipRepository memberships, FirmRepository firms) {
        this.users = users; this.memberships = memberships; this.firms = firms;
    }

    @Transactional(readOnly = true)
    public List<FirmAccessView> list(String email) {
        ForgeBoardUser user = users.findByEmail(email.toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new AccessDeniedException("Unknown account"));
        var access = memberships.findAllByUserId(user.id());
        Map<java.util.UUID, Firm> byId = firms.findAllById(access.stream().map(m -> m.firmId()).toList()).stream()
                .collect(Collectors.toMap(Firm::id, Function.identity()));
        return access.stream().filter(m -> byId.containsKey(m.firmId())).map(m -> {
            Firm firm = byId.get(m.firmId());
            return new FirmAccessView(firm.id(), firm.name(), firm.slug(), m.role());
        }).sorted(Comparator.comparing(FirmAccessView::name)).toList();
    }
}
