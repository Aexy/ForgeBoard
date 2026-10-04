package com.forgeboard.engagement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.access.AccessDeniedException;
import com.forgeboard.engagement.domain.EngagementStatus;
import com.forgeboard.engagement.persistence.EngagementPortfolioRepository;
import com.forgeboard.identity.EmployeeDirectory;
import com.forgeboard.identity.MembershipAccess;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.MembershipRole;

@ExtendWith(MockitoExtension.class)
class EngagementPortfolioServiceTest {
    @Mock EngagementPortfolioRepository portfolio;
    @Mock EmployeeDirectory employees;
    @Mock MembershipAccess membershipAccess;
    private EngagementPortfolioService service;
    private SelectedTenant owner;

    @BeforeEach void setUp() {
        owner = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "owner@example.com", MembershipRole.OWNER);
        service = new EngagementPortfolioService(portfolio, employees, membershipAccess,
                Clock.fixed(Instant.parse("2026-08-31T10:00:00Z"), ZoneOffset.UTC));
    }

    @Test void derivesOverlappingAttentionAndResolvesEmployeeNamesInOneFirmScopedBatch() {
        UUID preparer = UUID.randomUUID(); UUID reviewer = UUID.randomUUID();
        EngagementPortfolioRow row = new EngagementPortfolioRow(UUID.randomUUID(), UUID.randomUUID(), "Alpine GmbH",
                UUID.randomUUID(), "Monthly VAT", 2, preparer, reviewer, LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 31), LocalDate.of(2026, 8, 20), EngagementStatus.BLOCKED, "vat", "FB-42",
                true, false);
        when(portfolio.findPortfolio(eq(owner.firmId()), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(),
                isNull(), anyBoolean(), anyList(), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(),
                anyBoolean(), any(LocalDate.class), any(LocalDate.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(row)));
        when(employees.displayNames(owner.firmId(), List.of(preparer, reviewer)))
                .thenReturn(Map.of(preparer, "Ada Preparer", reviewer, "Rita Reviewer"));

        EngagementPortfolioPage page = service.list(owner, new EngagementPortfolioQuery(null, null, null, null, null,
                null, null, Set.of(), Set.of(), 0, 25));

        assertThat(page.content()).singleElement().satisfies(view -> {
            assertThat(view.preparerName()).isEqualTo("Ada Preparer");
            assertThat(view.reviewerName()).isEqualTo("Rita Reviewer");
            assertThat(view.attention()).containsExactlyInAnyOrder(EngagementAttention.OVERDUE, EngagementAttention.BLOCKED);
        });
        verify(membershipAccess).requireEngagementPortfolioAccess(owner);
        ArgumentCaptor<LocalDate> today = ArgumentCaptor.forClass(LocalDate.class);
        verify(portfolio).findPortfolio(eq(owner.firmId()), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(),
                isNull(), anyBoolean(), anyList(), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(),
                anyBoolean(), today.capture(), any(LocalDate.class), any(org.springframework.data.domain.Pageable.class));
        assertThat(today.getValue()).isEqualTo(LocalDate.of(2026, 8, 31));
    }

    @Test void rejectsRolesDeniedByServerPolicyBeforeAnyPortfolioQuery() {
        SelectedTenant member = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "member@example.com", MembershipRole.MEMBER);
        org.mockito.Mockito.doThrow(new AccessDeniedException("Only owners and managers can view the engagement portfolio"))
                .when(membershipAccess).requireEngagementPortfolioAccess(member);

        assertThatThrownBy(() -> service.list(member, new EngagementPortfolioQuery(null, null, null, null, null,
                null, null, Set.of(), Set.of(), 0, 25))).isInstanceOf(AccessDeniedException.class);
        org.mockito.Mockito.verifyNoInteractions(portfolio, employees);
    }

    @Test void keepsUnassignedPeopleNullWithoutLookingThemUp() {
        EngagementPortfolioRow row = new EngagementPortfolioRow(UUID.randomUUID(), UUID.randomUUID(), "Alpine GmbH",
                UUID.randomUUID(), "Monthly VAT", 2, null, null, LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 31), null, EngagementStatus.ACTIVE, "vat", "FB-42", false, false);
        when(portfolio.findPortfolio(eq(owner.firmId()), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(),
                isNull(), anyBoolean(), anyList(), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(),
                anyBoolean(), any(LocalDate.class), any(LocalDate.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(row)));
        when(employees.displayNames(owner.firmId(), List.of())).thenReturn(Map.of());

        EngagementPortfolioPage page = service.list(owner, new EngagementPortfolioQuery(null, null, null, null, null,
                null, null, Set.of(), Set.of(), 0, 25));

        assertThat(page.content()).singleElement().satisfies(view -> {
            assertThat(view.preparerName()).isNull();
            assertThat(view.reviewerName()).isNull();
        });
    }

    @Test void validatesPeriodBoundsAndPaginationBeforeCallingTheRepository() {
        assertThatThrownBy(() -> new EngagementPortfolioQuery("  search ", null, null, null, null,
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 7, 31), Set.of(), Set.of(), 0, 25))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("periodStart must not be after periodEnd");
        assertThatThrownBy(() -> new EngagementPortfolioQuery(null, null, null, null, null,
                null, null, Set.of(), Set.of(), 0, 101)).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("pageSize must be between 1 and 100");
    }
}
