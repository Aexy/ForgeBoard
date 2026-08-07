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

import com.forgeboard.identity.application.CreatePlatformFirmRequest;
import com.forgeboard.identity.application.GeneratedAccessLink;
import com.forgeboard.identity.application.InviteMemberRequest;
import com.forgeboard.identity.application.PlatformAccessManagementService;
import com.forgeboard.identity.application.PlatformAdministrationService;
import com.forgeboard.identity.application.PlatformEmployeeView;
import com.forgeboard.identity.application.PlatformFirmPage;
import com.forgeboard.identity.application.PlatformFirmView;
import com.forgeboard.identity.application.UpdateMembershipRoleRequest;

import jakarta.validation.Valid;

/** Thin adapter for the narrowly scoped platform-administration boundary. */
@RestController
@RequestMapping("/api/platform-admin")
public class PlatformAdministrationController {
    private final PlatformAdministrationService administration;
    private final PlatformAccessManagementService access;

    public PlatformAdministrationController(PlatformAdministrationService administration,
            PlatformAccessManagementService access) {
        this.administration = administration;
        this.access = access;
    }

    @GetMapping("/firms")
    PlatformFirmPage firms(Authentication actor, @RequestParam(required = false) String query,
            @RequestParam(required = false) String cursor) {
        return administration.listFirms(actor, query, cursor);
    }

    @PostMapping("/firms")
    ResponseEntity<PlatformFirmView> createFirm(Authentication actor,
            @Valid @RequestBody CreatePlatformFirmRequest request) {
        PlatformFirmView firm = administration.createFirm(actor, request);
        return ResponseEntity.created(URI.create("/api/platform-admin/firms/" + firm.id())).body(firm);
    }

    @PostMapping("/firms/{firmId}/suspension")
    PlatformFirmView suspendFirm(Authentication actor, @PathVariable UUID firmId) {
        return administration.suspendFirm(actor, firmId);
    }

    @DeleteMapping("/firms/{firmId}/suspension")
    PlatformFirmView reactivateFirm(Authentication actor, @PathVariable UUID firmId) {
        return administration.reactivateFirm(actor, firmId);
    }

    @GetMapping("/firms/{firmId}/employees")
    List<PlatformEmployeeView> employees(Authentication actor, @PathVariable UUID firmId) {
        return access.list(actor, firmId);
    }

    @PostMapping("/firms/{firmId}/employees")
    ResponseEntity<GeneratedAccessLink> inviteEmployee(Authentication actor, @PathVariable UUID firmId,
            @Valid @RequestBody InviteMemberRequest request) {
        GeneratedAccessLink invitation = access.invite(actor, firmId, request);
        return ResponseEntity.created(URI.create("/api/platform-admin/firms/" + firmId + "/employees/" + invitation.actionId()))
                .body(invitation);
    }

    @PostMapping("/firms/{firmId}/employees/{membershipId}/invitation")
    GeneratedAccessLink reissueInvitation(Authentication actor, @PathVariable UUID firmId, @PathVariable UUID membershipId) {
        return access.reissueInvitation(actor, firmId, membershipId);
    }

    @DeleteMapping("/firms/{firmId}/employees/{membershipId}/invitation")
    ResponseEntity<Void> revokeInvitation(Authentication actor, @PathVariable UUID firmId, @PathVariable UUID membershipId) {
        access.revokeInvitation(actor, firmId, membershipId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/firms/{firmId}/employees/{membershipId}/role")
    PlatformEmployeeView updateRole(Authentication actor, @PathVariable UUID firmId, @PathVariable UUID membershipId,
            @Valid @RequestBody UpdateMembershipRoleRequest request) {
        return access.updateRole(actor, firmId, membershipId, request);
    }

    @PostMapping("/firms/{firmId}/employees/{membershipId}/suspension")
    PlatformEmployeeView suspendMembership(Authentication actor, @PathVariable UUID firmId,
            @PathVariable UUID membershipId) {
        return access.suspend(actor, firmId, membershipId);
    }

    @DeleteMapping("/firms/{firmId}/employees/{membershipId}/suspension")
    PlatformEmployeeView reactivateMembership(Authentication actor, @PathVariable UUID firmId,
            @PathVariable UUID membershipId) {
        return access.reactivate(actor, firmId, membershipId);
    }

    @DeleteMapping("/firms/{firmId}/employees/{membershipId}")
    ResponseEntity<Void> removeMembership(Authentication actor, @PathVariable UUID firmId, @PathVariable UUID membershipId) {
        access.remove(actor, firmId, membershipId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{userId}/password-reset")
    GeneratedAccessLink createPasswordReset(Authentication actor, @PathVariable UUID userId) {
        return access.createPasswordReset(actor, userId);
    }
}
