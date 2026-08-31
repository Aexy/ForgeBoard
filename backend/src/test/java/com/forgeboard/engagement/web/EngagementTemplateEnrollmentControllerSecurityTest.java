package com.forgeboard.engagement.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.forgeboard.engagement.application.EngagementService;
import com.forgeboard.engagement.application.EngagementChecklistService;
import com.forgeboard.engagement.application.RecurrenceFailureService;
import com.forgeboard.engagement.application.EngagementPortfolioService;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;

@WebMvcTest(EngagementController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class})
class EngagementTemplateEnrollmentControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean EngagementService engagements;
    @MockitoBean EngagementChecklistService checklist;
    @MockitoBean RecurrenceFailureService recurrenceFailures;
    @MockitoBean EngagementPortfolioService portfolio;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test
    void routesTemplateChangesForEveryTemplateManagerRole() throws Exception {
        UUID firm = UUID.randomUUID(); UUID template = UUID.randomUUID();
        for (MembershipRole role : new MembershipRole[] {MembershipRole.OWNER, MembershipRole.ADMINISTRATOR, MembershipRole.MANAGER}) {
            String email = role.name().toLowerCase() + "@example.com";
            SelectedTenant tenant = authorize(firm, email, role);
            mockMvc.perform(put(templatePath(template)).with(user(email)).header(TenantSelectionFilter.FIRM_HEADER, firm)
                    .contentType(MediaType.APPLICATION_JSON).content(templateUpdateJson(UUID.randomUUID())))
                    .andExpect(status().isOk());
            verify(engagements).updateTemplate(eq(tenant), eq(template), any());
        }
    }

    @Test
    void deniesMemberAndReadOnlyEnrollmentMutations() throws Exception {
        UUID firm = UUID.randomUUID(); UUID template = UUID.randomUUID();
        for (MembershipRole role : new MembershipRole[] {MembershipRole.MEMBER, MembershipRole.READ_ONLY}) {
            String email = role.name().toLowerCase() + "@example.com";
            SelectedTenant tenant = authorize(firm, email, role);
            doThrow(new AccessDeniedException("Only owners, administrators, and managers can manage engagement templates"))
                    .when(engagements).enrollClients(eq(tenant), eq(template), any());
            mockMvc.perform(post(enrollmentPath(template)).with(user(email)).header(TenantSelectionFilter.FIRM_HEADER, firm)
                    .contentType(MediaType.APPLICATION_JSON).content(clientIdsJson(UUID.randomUUID())))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void routesUnenrollmentForManagers() throws Exception {
        UUID firm = UUID.randomUUID(); UUID template = UUID.randomUUID();
        SelectedTenant tenant = authorize(firm, "manager@example.com", MembershipRole.MANAGER);
        mockMvc.perform(delete(enrollmentPath(template)).with(user("manager@example.com"))
                .header(TenantSelectionFilter.FIRM_HEADER, firm).contentType(MediaType.APPLICATION_JSON)
                .content(clientIdsJson(UUID.randomUUID()))).andExpect(status().isOk());
        verify(engagements).unenrollClients(eq(tenant), eq(template), any());
    }

    private SelectedTenant authorize(UUID firm, String email, MembershipRole role) {
        SelectedTenant tenant = new SelectedTenant(firm, UUID.randomUUID(), email, role);
        when(tenantAuthorization.authorize(email, firm)).thenReturn(tenant);
        return tenant;
    }
    private String templatePath(UUID template) { return "/api/engagements/templates/" + template; }
    private String enrollmentPath(UUID template) { return templatePath(template) + "/enrollments"; }
    private String templateUpdateJson(UUID workflow) {
        return "{\"name\":\"VAT returns\",\"workflowId\":\"" + workflow
                + "\",\"recurrence\":\"MONTHLY\",\"defaultWorkItemTitle\":\"VAT {{period}}\",\"dueDay\":20,\"expectedVersion\":1}";
    }
    private String clientIdsJson(UUID client) { return "{\"clientIds\":[\"" + client + "\"]}"; }
}
