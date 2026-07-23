package com.forgeboard.identity.security;

import java.io.IOException;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.SelectedTenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class TenantSelectionFilter extends OncePerRequestFilter {
    public static final String FIRM_HEADER = "X-ForgeBoard-Firm";
    public static final String TENANT_PRINCIPAL_ATTRIBUTE = SelectedTenant.REQUEST_ATTRIBUTE;

    private final TenantAuthorizationService authorization;

    public TenantSelectionFilter(TenantAuthorizationService authorization) { this.authorization = authorization; }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/") || path.equals("/api/platform") || path.equals("/api/platform-admin")
                || path.startsWith("/api/platform-admin/")
                || path.equals("/api/onboarding/firms") || path.equals("/api/auth/grant")
                || path.equals("/api/auth/refresh") || path.equals("/api/auth/revoke")
                || path.equals("/api/identity/firms");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            chain.doFilter(request, response);
            return;
        }

        String firmHeader = request.getHeader(FIRM_HEADER);
        if (firmHeader == null || firmHeader.isBlank()) {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Missing " + FIRM_HEADER + " header");
            return;
        }
        try {
            UUID firmId = UUID.fromString(firmHeader);
            request.setAttribute(TENANT_PRINCIPAL_ATTRIBUTE, authorization.authorize(authentication.getName(), firmId));
            chain.doFilter(request, response);
        } catch (IllegalArgumentException exception) {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Invalid " + FIRM_HEADER + " header");
        } catch (AccessDeniedException exception) {
            response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "");
            response.sendError(HttpStatus.FORBIDDEN.value(), exception.getMessage());
        }
    }
}
