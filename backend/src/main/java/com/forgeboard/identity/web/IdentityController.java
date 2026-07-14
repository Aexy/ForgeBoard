package com.forgeboard.identity.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.security.TenantSelectionFilter;
import com.forgeboard.identity.application.FirmAccessService;
import com.forgeboard.identity.application.FirmAccessView;
import java.util.List;
import org.springframework.http.ResponseEntity;
import java.net.URI;
import jakarta.validation.Valid;
import com.forgeboard.identity.application.CreateEmployeeRequest;
import com.forgeboard.identity.application.EmployeeProvisioningService;
import com.forgeboard.identity.application.EmployeeView;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/identity")
public class IdentityController {
    private final FirmAccessService firmAccess;
    private final EmployeeProvisioningService employees;
    public IdentityController(FirmAccessService firmAccess, EmployeeProvisioningService employees) {
        this.firmAccess = firmAccess; this.employees = employees;
    }

    @GetMapping("/firms")
    List<FirmAccessView> firms(Authentication authentication) { return firmAccess.list(authentication.getName()); }

    @GetMapping("/me")
    SelectedTenant currentIdentity(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant principal) {
        return principal;
    }

    @GetMapping("/employees")
    List<EmployeeView> employees(@RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant) {
        return employees.list(tenant);
    }

    @PostMapping("/employees")
    ResponseEntity<EmployeeView> createEmployee(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @Valid @RequestBody CreateEmployeeRequest request) {
        EmployeeView employee = employees.create(tenant, request);
        return ResponseEntity.created(URI.create("/api/identity/employees/" + employee.membershipId())).body(employee);
    }
}
