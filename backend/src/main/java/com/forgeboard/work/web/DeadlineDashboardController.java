package com.forgeboard.work.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.application.DeadlineDashboardService;
import com.forgeboard.work.application.DeadlineDashboardView;

@RestController
@RequestMapping("/api/dashboard")
public class DeadlineDashboardController {
    private final DeadlineDashboardService dashboard;
    public DeadlineDashboardController(DeadlineDashboardService dashboard) { this.dashboard = dashboard; }
    @GetMapping DeadlineDashboardView overview(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant) { return dashboard.overview(tenant); }
}
