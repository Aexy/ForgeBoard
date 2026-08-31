package com.forgeboard.engagement.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.forgeboard.engagement.application.EngagementChecklistService;
import com.forgeboard.engagement.application.EngagementPortfolioService;
import com.forgeboard.engagement.application.EngagementService;
import com.forgeboard.engagement.application.RecurrenceFailureService;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;

@WebMvcTest(EngagementController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class})
class EngagementPortfolioControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean EngagementService engagements;
    @MockitoBean EngagementChecklistService checklist;
    @MockitoBean RecurrenceFailureService recurrenceFailures;
    @MockitoBean EngagementPortfolioService portfolio;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test void rejectsUnauthenticatedPortfolioRequests() throws Exception {
        mockMvc.perform(get("/api/engagements/portfolio")).andExpect(status().isUnauthorized());
        verifyNoInteractions(portfolio, tenantAuthorization);
    }

    @Test void routesOwnersAndManagersWithOnlyTheirSelectedFirm() throws Exception {
        UUID firm = UUID.randomUUID();
        for (MembershipRole role : new MembershipRole[] {MembershipRole.OWNER, MembershipRole.MANAGER}) {
            String email = role.name().toLowerCase() + "@example.com";
            SelectedTenant tenant = authorize(firm, email, role);
            mockMvc.perform(get("/api/engagements/portfolio?page=1&pageSize=50&attention=OVERDUE&attention=BLOCKED")
                    .with(user(email)).header(TenantSelectionFilter.FIRM_HEADER, firm)).andExpect(status().isOk());
            verify(portfolio).list(eq(tenant), any());
        }
    }

    @Test void mapsAdministratorMemberAndReadOnlyPortfolioAccessToForbidden() throws Exception {
        UUID firm = UUID.randomUUID();
        for (MembershipRole role : new MembershipRole[] {MembershipRole.ADMINISTRATOR, MembershipRole.MEMBER, MembershipRole.READ_ONLY}) {
            String email = role.name().toLowerCase() + "@example.com";
            SelectedTenant tenant = authorize(firm, email, role);
            doThrow(new AccessDeniedException("Only owners and managers can view the engagement portfolio"))
                    .when(portfolio).list(eq(tenant), any());
            mockMvc.perform(get("/api/engagements/portfolio").with(user(email))
                    .header(TenantSelectionFilter.FIRM_HEADER, firm)).andExpect(status().isForbidden());
        }
    }

    @Test void rejectsInvalidPortfolioBoundsWithBadRequest() throws Exception {
        UUID firm = UUID.randomUUID();
        String email = "owner@example.com";
        authorize(firm, email, MembershipRole.OWNER);
        mockMvc.perform(get("/api/engagements/portfolio?periodStart=2026-08-01&periodEnd=2026-07-31")
                .with(user(email)).header(TenantSelectionFilter.FIRM_HEADER, firm)).andExpect(status().isBadRequest());
        verifyNoInteractions(portfolio);
    }

    private SelectedTenant authorize(UUID firm, String email, MembershipRole role) {
        SelectedTenant tenant = new SelectedTenant(firm, UUID.randomUUID(), email, role);
        when(tenantAuthorization.authorize(email, firm)).thenReturn(tenant);
        return tenant;
    }
}
