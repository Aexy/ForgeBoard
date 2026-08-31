package com.forgeboard.document.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.forgeboard.document.application.DocumentRequestService;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;

@WebMvcTest(DocumentRequestController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class})
class DocumentRequestControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean DocumentRequestService requests;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test
    void rejectsUnauthenticatedFollowUpMutations() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(patch(path(id, "reminded"))).andExpect(status().isUnauthorized());
        mockMvc.perform(patch(path(id, "escalated"))).andExpect(status().isUnauthorized());

        verifyNoInteractions(requests, tenantAuthorization);
    }

    @Test
    void requiresTheSelectedFirmForFollowUpMutations() throws Exception {
        mockMvc.perform(patch(path(UUID.randomUUID(), "reminded")).with(user("member@example.com")))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(requests, tenantAuthorization);
    }

    @Test
    void rejectsUsersOutsideTheSelectedFirmBeforeFollowUpLookup() throws Exception {
        UUID firmId = UUID.randomUUID();
        when(tenantAuthorization.authorize("member@example.com", firmId))
                .thenThrow(new AccessDeniedException("User is not a member of this firm"));

        mockMvc.perform(patch(path(UUID.randomUUID(), "reminded")).with(user("member@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isForbidden());

        verifyNoInteractions(requests);
    }

    @Test
    void routesFollowUpActionsUsingOnlyTheRouteId() throws Exception {
        UUID firmId = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, "owner@example.com", MembershipRole.OWNER);

        mockMvc.perform(patch(path(id, "reminded")).with(user("owner@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isOk());
        mockMvc.perform(patch(path(id, "escalated")).with(user("owner@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isOk());

        verify(requests).recordReminder(eq(tenant), eq(id));
        verify(requests).escalate(eq(tenant), eq(id));
    }

    private SelectedTenant authorize(UUID firmId, String email, MembershipRole role) {
        SelectedTenant tenant = new SelectedTenant(firmId, UUID.randomUUID(), email, role);
        when(tenantAuthorization.authorize(email, firmId)).thenReturn(tenant);
        return tenant;
    }

    private String path(UUID id, String action) {
        return "/api/document-requests/" + id + "/" + action;
    }
}
