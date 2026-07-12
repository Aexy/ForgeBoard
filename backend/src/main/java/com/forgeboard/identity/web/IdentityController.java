package com.forgeboard.identity.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.security.TenantSelectionFilter;
import com.forgeboard.identity.application.FirmAccessService;
import com.forgeboard.identity.application.FirmAccessView;
import java.util.List;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/identity")
public class IdentityController {
    private final FirmAccessService firmAccess;
    public IdentityController(FirmAccessService firmAccess) { this.firmAccess = firmAccess; }

    @GetMapping("/firms")
    List<FirmAccessView> firms(Authentication authentication) { return firmAccess.list(authentication.getName()); }

    @GetMapping("/me")
    SelectedTenant currentIdentity(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant principal) {
        return principal;
    }
}
