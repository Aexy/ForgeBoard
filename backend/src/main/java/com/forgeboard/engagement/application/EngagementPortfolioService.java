package com.forgeboard.engagement.application;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.engagement.domain.EngagementStatus;
import com.forgeboard.engagement.persistence.EngagementPortfolioRepository;
import com.forgeboard.identity.EmployeeDirectory;
import com.forgeboard.identity.MembershipAccess;
import com.forgeboard.identity.SelectedTenant;

@Service
public class EngagementPortfolioService {
    private final EngagementPortfolioRepository portfolio;
    private final EmployeeDirectory employees;
    private final MembershipAccess membershipAccess;
    private final Clock clock;

    public EngagementPortfolioService(EngagementPortfolioRepository portfolio, EmployeeDirectory employees,
            MembershipAccess membershipAccess, Clock clock) {
        this.portfolio = portfolio; this.employees = employees; this.membershipAccess = membershipAccess; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public EngagementPortfolioPage list(SelectedTenant tenant, EngagementPortfolioQuery query) {
        membershipAccess.requireEngagementPortfolioAccess(tenant);
        LocalDate today = LocalDate.now(clock);
        // Keep an IN binding non-empty even when the default-status branch makes it irrelevant.
        List<EngagementStatus> statuses = query.status().isEmpty() ? List.of(EngagementStatus.ACTIVE) : query.status().stream().toList();
        Page<EngagementPortfolioRow> rows = portfolio.findPortfolio(tenant.firmId(), query.query(), query.clientId(),
                query.templateId(), query.preparerUserId(), query.reviewerUserId(), query.periodStart(), query.periodEnd(),
                query.status().isEmpty(), statuses, query.attention().isEmpty(),
                query.attention().contains(EngagementAttention.OVERDUE), query.attention().contains(EngagementAttention.DUE_SOON),
                query.attention().contains(EngagementAttention.BLOCKED), query.attention().contains(EngagementAttention.UNASSIGNED),
                query.attention().contains(EngagementAttention.AWAITING_REVIEW), today, today.plusDays(7),
                PageRequest.of(query.page(), query.pageSize()));
        Map<UUID, String> names = employees.displayNames(tenant.firmId(), rows.getContent().stream()
                .flatMap(row -> java.util.stream.Stream.of(row.preparerUserId(), row.reviewerUserId()))
                .filter(java.util.Objects::nonNull).distinct().toList());
        return new EngagementPortfolioPage(rows.getContent().stream().map(row -> row.view(names.get(row.preparerUserId()),
                names.get(row.reviewerUserId()), attention(row, today))).toList(), rows.getNumber(), rows.getSize(),
                rows.getTotalElements(), rows.getTotalPages());
    }

    private Set<EngagementAttention> attention(EngagementPortfolioRow row, LocalDate today) {
        java.util.EnumSet<EngagementAttention> attention = java.util.EnumSet.noneOf(EngagementAttention.class);
        if (row.dueDate() != null && row.dueDate().isBefore(today)) attention.add(EngagementAttention.OVERDUE);
        else if (row.dueDate() != null && !row.dueDate().isAfter(today.plusDays(7))) attention.add(EngagementAttention.DUE_SOON);
        if (row.status() == EngagementStatus.BLOCKED || row.blockedStage())
            attention.add(EngagementAttention.BLOCKED);
        if (row.status() == EngagementStatus.AWAITING_REVIEW || row.awaitingReviewStage())
            attention.add(EngagementAttention.AWAITING_REVIEW);
        if (row.preparerUserId() == null) attention.add(EngagementAttention.UNASSIGNED);
        return Set.copyOf(attention);
    }
}
