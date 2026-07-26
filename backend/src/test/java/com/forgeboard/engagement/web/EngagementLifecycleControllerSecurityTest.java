package com.forgeboard.engagement.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import com.forgeboard.engagement.application.EngagementAlreadyExistsException;
import com.forgeboard.engagement.application.EngagementNotFoundException;
import com.forgeboard.engagement.application.EngagementService;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;

@WebMvcTest(EngagementController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class})
class EngagementLifecycleControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean EngagementService engagements;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test void rejectsUnauthenticatedLifecycleMutations() throws Exception {
        mockMvc.perform(post(path(UUID.randomUUID(), "cancel")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":0}")).andExpect(status().isUnauthorized());
        verifyNoInteractions(engagements, tenantAuthorization);
    }

    @Test void routesOwnerAndManagerLifecycleActions() throws Exception {
        UUID firm = UUID.randomUUID(); UUID id = UUID.randomUUID();
        SelectedTenant owner = authorize(firm, "owner@example.com", MembershipRole.OWNER);
        mockMvc.perform(post(path(id, "cancel")).with(user("owner@example.com"))
                .header(TenantSelectionFilter.FIRM_HEADER, firm).contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":0}")).andExpect(status().isOk());
        verify(engagements).cancel(eq(owner), eq(id), any());
        SelectedTenant manager = authorize(firm, "manager@example.com", MembershipRole.MANAGER);
        mockMvc.perform(post(path(id, "archive")).with(user("manager@example.com"))
                .header(TenantSelectionFilter.FIRM_HEADER, firm).contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":1}")).andExpect(status().isOk());
        verify(engagements).archive(eq(manager), eq(id), any());
    }

    @Test void mapsNonOwnerManagerRolesToForbidden() throws Exception {
        UUID firm = UUID.randomUUID(); UUID id = UUID.randomUUID();
        for (MembershipRole role : new MembershipRole[] {MembershipRole.ADMINISTRATOR, MembershipRole.MEMBER, MembershipRole.READ_ONLY}) {
            String email = role.name().toLowerCase() + "@example.com";
            SelectedTenant tenant = authorize(firm, email, role);
            doThrow(new AccessDeniedException("Only owners and managers can manage an engagement lifecycle"))
                    .when(engagements).cancel(eq(tenant), eq(id), any());
            mockMvc.perform(post(path(id, "cancel")).with(user(email)).header(TenantSelectionFilter.FIRM_HEADER, firm)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":0}"))
                    .andExpect(status().isForbidden());
        }
    }

    @Test void mapsCrossFirmDetailsToNotFoundAndLifecycleConflictsTo409() throws Exception {
        UUID firm = UUID.randomUUID(); UUID id = UUID.randomUUID(); SelectedTenant tenant = authorize(firm, "owner@example.com", MembershipRole.OWNER);
        when(engagements.getEngagement(tenant, id)).thenThrow(new EngagementNotFoundException("Engagement was not found in the selected firm"));
        mockMvc.perform(get("/api/engagements/" + id).with(user("owner@example.com")).header(TenantSelectionFilter.FIRM_HEADER, firm))
                .andExpect(status().isNotFound());
        doThrow(new EngagementAlreadyExistsException("The engagement was changed by another user"))
                .when(engagements).reopen(eq(tenant), eq(id), any());
        mockMvc.perform(post(path(id, "reopen")).with(user("owner@example.com")).header(TenantSelectionFilter.FIRM_HEADER, firm)
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":0}"))
                .andExpect(status().isConflict());
    }
    @Test void mapsOptimisticLifecycleFailuresToConflict() throws Exception {
        UUID firm = UUID.randomUUID(); UUID id = UUID.randomUUID(); SelectedTenant tenant = authorize(firm, "owner@example.com", MembershipRole.OWNER);
        doThrow(new org.springframework.orm.ObjectOptimisticLockingFailureException("engagement", id))
                .when(engagements).archive(eq(tenant), eq(id), any());
        mockMvc.perform(post(path(id, "archive")).with(user("owner@example.com")).header(TenantSelectionFilter.FIRM_HEADER, firm)
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":0}"))
                .andExpect(status().isConflict());
    }
    private SelectedTenant authorize(UUID firm, String email, MembershipRole role) {
        SelectedTenant tenant = new SelectedTenant(firm, UUID.randomUUID(), email, role);
        when(tenantAuthorization.authorize(email, firm)).thenReturn(tenant); return tenant;
    }
    private String path(UUID id, String action) { return "/api/engagements/" + id + "/" + action; }
}
