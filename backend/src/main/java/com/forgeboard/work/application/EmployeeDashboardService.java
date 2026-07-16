package com.forgeboard.work.application;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.persistence.WorkItemAssignmentRepository;
@Service
public class EmployeeDashboardService {
    private final WorkItemAssignmentRepository assignments; private final Clock clock;
    public EmployeeDashboardService(WorkItemAssignmentRepository assignments, Clock clock) { this.assignments = assignments; this.clock = clock; }
    @Transactional(readOnly = true)
    public EmployeeDashboardView dashboard(SelectedTenant tenant) {
        LocalDate today = LocalDate.now(clock);
        return EmployeeDashboardView.group(assignments.findDashboardByFirmIdAndUserId(tenant.firmId(), tenant.userId()), today);
    }
}
