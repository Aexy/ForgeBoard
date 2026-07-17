package com.forgeboard.work.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.work.domain.StageAttention;
import com.forgeboard.work.persistence.WorkItemAssignmentRepository;

@ExtendWith(MockitoExtension.class)
class EmployeeDashboardServiceTest {
    @Mock WorkItemAssignmentRepository assignments;
    @Test
    void dashboardUsesFirmAndAuthenticatedEmployee() {
        SelectedTenant tenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "employee@example.com", MembershipRole.MEMBER);
        LocalDate today = LocalDate.of(2026, 7, 14);
        when(assignments.findDashboardByFirmIdAndUserId(tenant.firmId(), tenant.userId())).thenReturn(List.of(
                new EmployeeWorkItemView("FB-1042", "Chase bank feed", "monthly-close", "Client dependency",
                        StageAttention.BLOCKED, null)));
        EmployeeDashboardView dashboard = new EmployeeDashboardService(assignments, Clock.fixed(Instant.parse("2026-07-14T00:00:00Z"), ZoneOffset.UTC)).dashboard(tenant);
        assertThat(dashboard.blocked()).extracting(EmployeeWorkItemView::taskReference).containsExactly("FB-1042");
        verify(assignments).findDashboardByFirmIdAndUserId(tenant.firmId(), tenant.userId());
    }
}
