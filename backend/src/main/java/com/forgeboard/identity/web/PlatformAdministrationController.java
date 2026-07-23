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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.identity.application.CreatePlatformEmployeeRequest;
import com.forgeboard.identity.application.CreatePlatformFirmRequest;
import com.forgeboard.identity.application.PlatformAdministrationService;
import com.forgeboard.identity.application.PlatformEmployeeView;
import com.forgeboard.identity.application.PlatformFirmPage;
import com.forgeboard.identity.application.PlatformFirmView;
import com.forgeboard.identity.application.UpdateMembershipRoleRequest;

import jakarta.validation.Valid;

/** Thin adapter for the narrowly scoped platform-administration boundary. */
@RestController
@RequestMapping("/api/platform-admin/firms")
public class PlatformAdministrationController {
    private final PlatformAdministrationService administration;

    public PlatformAdministrationController(PlatformAdministrationService administration) {
        this.administration = administration;
    }

    @GetMapping
    PlatformFirmPage firms(Authentication actor, @RequestParam(required = false) String query,
            @RequestParam(required = false) String cursor) {
        return administration.listFirms(actor, query, cursor);
    }

    @PostMapping
    ResponseEntity<PlatformFirmView> createFirm(Authentication actor,
            @Valid @RequestBody CreatePlatformFirmRequest request) {
        PlatformFirmView firm = administration.createFirm(actor, request);
        return ResponseEntity.created(URI.create("/api/platform-admin/firms/" + firm.id())).body(firm);
    }

    @PostMapping("/{firmId}/suspension")
    PlatformFirmView suspendFirm(Authentication actor, @PathVariable UUID firmId) {
        return administration.suspendFirm(actor, firmId);
    }

    @DeleteMapping("/{firmId}/suspension")
    PlatformFirmView reactivateFirm(Authentication actor, @PathVariable UUID firmId) {
        return administration.reactivateFirm(actor, firmId);
    }

    @GetMapping("/{firmId}/employees")
    List<PlatformEmployeeView> employees(Authentication actor, @PathVariable UUID firmId) {
        return administration.listEmployees(actor, firmId);
    }

    @PostMapping("/{firmId}/employees")
    ResponseEntity<PlatformEmployeeView> createEmployee(Authentication actor, @PathVariable UUID firmId,
            @Valid @RequestBody CreatePlatformEmployeeRequest request) {
        PlatformEmployeeView employee = administration.createEmployee(actor, firmId, request);
        return ResponseEntity.created(URI.create("/api/platform-admin/firms/" + firmId + "/employees/" + employee.membershipId()))
                .body(employee);
    }

    @PutMapping("/{firmId}/employees/{membershipId}/role")
    PlatformEmployeeView updateRole(Authentication actor, @PathVariable UUID firmId, @PathVariable UUID membershipId,
            @Valid @RequestBody UpdateMembershipRoleRequest request) {
        return administration.updateRole(actor, firmId, membershipId, request);
    }

    @PostMapping("/{firmId}/employees/{membershipId}/suspension")
    PlatformEmployeeView suspendMembership(Authentication actor, @PathVariable UUID firmId,
            @PathVariable UUID membershipId) {
        return administration.suspendMembership(actor, firmId, membershipId);
    }

    @DeleteMapping("/{firmId}/employees/{membershipId}/suspension")
    PlatformEmployeeView reactivateMembership(Authentication actor, @PathVariable UUID firmId,
            @PathVariable UUID membershipId) {
        return administration.reactivateMembership(actor, firmId, membershipId);
    }
}
