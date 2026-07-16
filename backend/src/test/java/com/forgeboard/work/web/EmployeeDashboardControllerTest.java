package com.forgeboard.work.web;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;
import com.forgeboard.work.application.EmployeeDashboardService;
import com.forgeboard.work.application.EmployeeDashboardView;

@WebMvcTest(EmployeeDashboardController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class})
class EmployeeDashboardControllerTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean EmployeeDashboardService dashboard;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test
    void rejectsUnauthenticatedDashboardRequests() throws Exception {
        mockMvc.perform(get("/api/dashboard/my-work"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(dashboard, tenantAuthorization);
    }

    @Test
    void returnsOnlyTheSelectedMembersDashboard() throws Exception {
        UUID firmId = UUID.randomUUID();
        SelectedTenant tenant = new SelectedTenant(firmId, UUID.randomUUID(), "employee@example.com", MembershipRole.MEMBER);
        when(tenantAuthorization.authorize("employee@example.com", firmId)).thenReturn(tenant);
        when(dashboard.dashboard(tenant)).thenReturn(new EmployeeDashboardView(LocalDate.of(2026, 7, 14),
                List.of(), List.of(), List.of(), List.of(), List.of()));

        mockMvc.perform(get("/api/dashboard/my-work")
                        .with(user("employee@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.today").value("2026-07-14"));
    }

    @Test
    void rejectsAnAuthenticatedUserWithoutMembershipInTheSelectedFirm() throws Exception {
        UUID otherFirmId = UUID.randomUUID();
        when(tenantAuthorization.authorize("employee@example.com", otherFirmId))
                .thenThrow(new AccessDeniedException("User is not a member of this firm"));

        mockMvc.perform(get("/api/dashboard/my-work")
                        .with(user("employee@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, otherFirmId))
                .andExpect(status().isForbidden());
        verifyNoInteractions(dashboard);
    }
}
