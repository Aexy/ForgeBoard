package com.forgeboard.identity.security;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.forgeboard.identity.application.TenantAuthorizationService;

@ExtendWith(MockitoExtension.class)
class TenantSelectionFilterTest {
    @Mock TenantAuthorizationService authorization;
    @Mock HttpServletRequest request;
    @Mock HttpServletResponse response;
    @Mock FilterChain chain;

    @Test
    void doesNotRequireAFirmHeaderForThePlatformAdministrationRouteRoot() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/platform-admin");

        new TenantSelectionFilter(authorization).doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }
}
