package com.forgeboard.identity.web;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.EmployeeView;
import com.forgeboard.identity.application.FirmAccessManagementService;
import com.forgeboard.identity.application.FirmAccessService;
import com.forgeboard.identity.application.FirmAccessView;
import com.forgeboard.identity.application.GeneratedAccessLink;
import com.forgeboard.identity.application.InviteMemberRequest;
import com.forgeboard.identity.application.UpdateMembershipRoleRequest;
import com.forgeboard.identity.security.TenantSelectionFilter;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/identity")
public class IdentityController {
    private final FirmAccessService firmAccess;
    private final FirmAccessManagementService access;

    public IdentityController(FirmAccessService firmAccess, FirmAccessManagementService access) {
        this.firmAccess = firmAccess;
        this.access = access;
    }

    @GetMapping("/firms")
    List<FirmAccessView> firms(Authentication authentication) {
        return firmAccess.list(authentication.getName());
    }

    @GetMapping("/me")
    SelectedTenant currentIdentity(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant principal) {
        return principal;
    }

    @GetMapping("/employees")
    List<EmployeeView> employees(@RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant) {
        return access.list(tenant);
    }

    @PostMapping("/employees")
    ResponseEntity<GeneratedAccessLink> inviteEmployee(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @Valid @RequestBody InviteMemberRequest request) {
        GeneratedAccessLink invitation = access.invite(tenant, request);
        return ResponseEntity.created(URI.create("/api/identity/employees/" + invitation.actionId())).body(invitation);
    }

    @PostMapping("/employees/{membershipId}/invitation")
    GeneratedAccessLink reissueInvitation(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID membershipId) {
        return access.reissueInvitation(tenant, membershipId);
    }

    @DeleteMapping("/employees/{membershipId}/invitation")
    ResponseEntity<Void> revokeInvitation(
            @RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID membershipId) {
        access.revokeInvitation(tenant, membershipId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/employees/{membershipId}/role")
    EmployeeView updateRole(@RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID membershipId, @Valid @RequestBody UpdateMembershipRoleRequest request) {
        return access.updateRole(tenant, membershipId, request);
    }

    @PostMapping("/employees/{membershipId}/suspension")
    EmployeeView suspend(@RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID membershipId) {
        return access.suspend(tenant, membershipId);
    }

    @DeleteMapping("/employees/{membershipId}/suspension")
    EmployeeView reactivate(@RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID membershipId) {
        return access.reactivate(tenant, membershipId);
    }

    @DeleteMapping("/employees/{membershipId}")
    ResponseEntity<Void> remove(@RequestAttribute(TenantSelectionFilter.TENANT_PRINCIPAL_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID membershipId) {
        access.remove(tenant, membershipId);
        return ResponseEntity.noContent().build();
    }
}
