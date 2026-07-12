package com.forgeboard.identity.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.identity.application.TenantPrincipal;
import com.forgeboard.identity.security.TenantSelectionFilter;

@RestController
@RequestMapping("/api/identity")
public class IdentityController {
    @GetMapping("/me")
    TenantPrincipal currentIdentity(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) TenantPrincipal principal) {
        return principal;
    }
}

