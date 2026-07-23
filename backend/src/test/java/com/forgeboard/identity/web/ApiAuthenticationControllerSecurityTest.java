package com.forgeboard.identity.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.forgeboard.identity.application.FirmAccessView;
import com.forgeboard.identity.application.SessionIdentity;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.security.ApiTokenService;
import com.forgeboard.identity.security.ApiTokenService.ApiGrant;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;

@WebMvcTest(ApiAuthenticationController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class})
class ApiAuthenticationControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean ApiTokenService tokens;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test
    void invalidGrantReturnsARedactedUnauthorizedResponse() throws Exception {
        when(tokens.grant(any())).thenThrow(new BadCredentialsException("raw credential must never be returned"));

        mockMvc.perform(post("/api/auth/grant").contentType("application/json")
                        .content("{\"email\":\"owner@example.com\",\"password\":\"not-a-token\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid API credentials"));
    }

    @Test
    void grantDoesNotCreateABrowserSession() throws Exception {
        when(tokens.grant(any())).thenReturn(new ApiGrant("access-token-value", Instant.parse("2026-07-16T12:15:00Z"),
                "refresh-token-value", new SessionIdentity("owner@example.com"), List.<FirmAccessView>of(), false));

        mockMvc.perform(post("/api/auth/grant").contentType("application/json")
                        .content("{\"email\":\"owner@example.com\",\"password\":\"correct horse battery\"}"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(jsonPath("$.accessToken").value("access-token-value"));
    }
}
