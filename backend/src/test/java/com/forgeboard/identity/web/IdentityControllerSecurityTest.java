package com.forgeboard.identity.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.FirmAccessManagementService;
import com.forgeboard.identity.application.FirmAccessService;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;

@WebMvcTest(IdentityController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class, IdentityExceptionHandler.class})
class IdentityControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean FirmAccessService firmAccess;
    @MockitoBean FirmAccessManagementService access;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test
    void authenticatedAdministratorGetsForbiddenWhenInvitingAnOwner() throws Exception {
        UUID firmId = UUID.randomUUID();
        SelectedTenant administrator = new SelectedTenant(firmId, UUID.randomUUID(), "admin@example.com",
                MembershipRole.ADMINISTRATOR);
        org.mockito.Mockito.when(tenantAuthorization.authorize("admin@example.com", firmId)).thenReturn(administrator);
        doThrow(new AccessDeniedException("Only owners can manage owner memberships"))
                .when(access).invite(eq(administrator), any());

        mockMvc.perform(post("/api/identity/employees")
                        .with(user("admin@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId)
                        .contentType("application/json")
                        .content("{\"displayName\":\"Prohibited Owner\",\"email\":\"owner@example.com\",\"role\":\"OWNER\"}"))
                .andExpect(status().isForbidden());
    }
}
