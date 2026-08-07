package com.forgeboard.identity.application;

import java.util.List;

import org.springframework.stereotype.Service;

import com.forgeboard.identity.SelectedTenant;

/** Compatibility facade for callers that still use the employee-provisioning application contract. */
@Service
public class EmployeeProvisioningService {
    private final FirmAccessManagementService access;

    public EmployeeProvisioningService(FirmAccessManagementService access) {
        this.access = access;
    }

    public GeneratedAccessLink create(SelectedTenant actor, InviteMemberRequest request) {
        return access.invite(actor, request);
    }

    public List<EmployeeView> list(SelectedTenant actor) {
        return access.list(actor);
    }
}
