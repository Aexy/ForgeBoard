package com.forgeboard.work.web;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.application.EmployeeDashboardService;
import com.forgeboard.work.application.EmployeeDashboardView;
@RestController
public class EmployeeDashboardController {
    private final EmployeeDashboardService dashboard;
    public EmployeeDashboardController(EmployeeDashboardService dashboard) { this.dashboard = dashboard; }
    @GetMapping("/api/dashboard/my-work")
    EmployeeDashboardView myWork(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant) {
        return dashboard.dashboard(tenant);
    }
}
