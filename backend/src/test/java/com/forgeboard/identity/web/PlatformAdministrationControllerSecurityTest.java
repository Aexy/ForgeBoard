package com.forgeboard.identity.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.forgeboard.identity.application.PlatformAdministrationService;
import com.forgeboard.identity.application.PlatformFirmPage;
import com.forgeboard.identity.application.PlatformFirmView;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.domain.FirmStatus;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;

@WebMvcTest(PlatformAdministrationController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class, IdentityExceptionHandler.class})
class PlatformAdministrationControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean PlatformAdministrationService administration;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test
    void anonymousPlatformAdministrationRequestIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/platform-admin/firms")).andExpect(status().isUnauthorized());
    }

    @Test
    void normalUserIsForbiddenWhenServiceRejectsPlatformEntitlement() throws Exception {
        doThrow(new AccessDeniedException("Platform administrator access is required"))
                .when(administration).listFirms(any(), any(), any());

        mockMvc.perform(get("/api/platform-admin/firms").with(user("member@example.com")))
                .andExpect(status().isForbidden());
    }

    @Test
    void entitledUserCanListWithoutTenantHeader() throws Exception {
        PlatformFirmView firm = new PlatformFirmView(UUID.randomUUID(), "Northstar", "northstar", FirmStatus.ACTIVE,
                Instant.parse("2026-07-23T12:00:00Z"), 2);
        org.mockito.Mockito.when(administration.listFirms(any(), any(), any()))
                .thenReturn(new PlatformFirmPage(List.of(firm), null));

        mockMvc.perform(get("/api/platform-admin/firms").with(user("admin@example.com")))
                .andExpect(status().isOk());
        verify(administration).listFirms(any(), eq(null), eq(null));
    }

    @Test
    void platformMutationRequiresAuthenticationAndReachesTheApplicationService() throws Exception {
        UUID firmId = UUID.randomUUID();
        mockMvc.perform(post("/api/platform-admin/firms/" + firmId + "/suspension")
                        .with(user("admin@example.com")))
                .andExpect(status().isOk());
        verify(administration).suspendFirm(any(), eq(firmId));
    }

    @Test
    void ordinaryTenantEndpointStillRequiresFirmHeader() throws Exception {
        mockMvc.perform(get("/api/identity/me").with(user("member@example.com")))
                .andExpect(status().isBadRequest());
    }
}
