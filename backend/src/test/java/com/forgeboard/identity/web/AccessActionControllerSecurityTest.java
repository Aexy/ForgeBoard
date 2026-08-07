package com.forgeboard.identity.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.forgeboard.identity.application.AccessLifecycleService;
import com.forgeboard.identity.application.InvalidIdentityException;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;

@WebMvcTest(AccessActionController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class, IdentityExceptionHandler.class})
class AccessActionControllerSecurityTest {
    private static final String GENERIC_ERROR = "This access link is invalid or has expired.";

    @Autowired MockMvc mockMvc;
    @MockitoBean AccessLifecycleService lifecycle;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test
    void publicNewAccountAcceptanceDoesNotRequireAuthenticationOrAFirmHeader() throws Exception {
        doNothing().when(lifecycle).acceptNewAccountInvitation(any());

        mockMvc.perform(post("/api/access/invitations/token-value/accept-new")
                        .contentType("application/json")
                        .content("{\"displayName\":\"New member\",\"password\":\"correct horse battery\"}"))
                .andExpect(status().isNoContent())
                .andExpect(header().doesNotExist("Set-Cookie"));

        verify(lifecycle).acceptNewAccountInvitation(any());
    }

    @Test
    void publicResetCompletionDoesNotRequireAuthenticationOrAFirmHeader() throws Exception {
        doNothing().when(lifecycle).completePasswordReset(eq(null), any());

        mockMvc.perform(post("/api/access/password-resets/token-value/complete")
                        .contentType("application/json")
                        .content("{\"password\":\"correct horse battery\"}"))
                .andExpect(status().isNoContent());

        verify(lifecycle).completePasswordReset(eq(null), any());
    }

    @Test
    void existingAccountAcceptanceRequiresAuthenticationButNoFirmHeader() throws Exception {
        mockMvc.perform(post("/api/access/invitations/token-value/accept-existing"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/access/invitations/token-value/accept-existing").with(user("member@example.com")))
                .andExpect(status().isNoContent());

        verify(lifecycle).acceptExistingAccountInvitation(eq("member@example.com"), any());
    }

    @Test
    void everyUnusableOrMismatchedLinkReturnsTheSameGenericError() throws Exception {
        doThrow(new InvalidIdentityException("malformed")).when(lifecycle).acceptNewAccountInvitation(any());
        assertGeneric(post("/api/access/invitations/malformed/accept-new")
                .contentType("application/json").content(newInvitation()));

        doThrow(new InvalidIdentityException("expired")).when(lifecycle).acceptNewAccountInvitation(any());
        assertGeneric(post("/api/access/invitations/expired/accept-new")
                .contentType("application/json").content(newInvitation()));

        doThrow(new InvalidIdentityException("consumed")).when(lifecycle).completePasswordReset(eq(null), any());
        assertGeneric(post("/api/access/password-resets/consumed/complete")
                .contentType("application/json").content(reset()));

        doThrow(new InvalidIdentityException("revoked")).when(lifecycle).completePasswordReset(eq(null), any());
        assertGeneric(post("/api/access/password-resets/revoked/complete")
                .contentType("application/json").content(reset()));

        doThrow(new AccessDeniedException("wrong recipient")).when(lifecycle)
                .acceptExistingAccountInvitation(eq("member@example.com"), any());
        assertGeneric(post("/api/access/invitations/mismatched/accept-existing").with(user("member@example.com")));
    }

    @Test
    void onlyTheExactPublicRedemptionPathsArePermitted() throws Exception {
        mockMvc.perform(post("/api/access/invitations/token-value/accept-new/unexpected")
                        .contentType("application/json").content(newInvitation()))
                .andExpect(status().isUnauthorized());
    }

    private void assertGeneric(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request)
            throws Exception {
        mockMvc.perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(GENERIC_ERROR));
    }

    private static String newInvitation() {
        return "{\"displayName\":\"New member\",\"password\":\"correct horse battery\"}";
    }

    private static String reset() { return "{\"password\":\"correct horse battery\"}"; }
}
