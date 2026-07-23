package com.forgeboard.work.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;
import com.forgeboard.work.application.WorkflowService;
import com.forgeboard.work.application.WorkNotFoundException;
import com.forgeboard.work.application.WorkflowFilterView;

@WebMvcTest(WorkflowController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class})
class WorkflowControllerSecurityTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean WorkflowService workflows;
    @MockitoBean TenantAuthorizationService tenantAuthorization;

    @Test
    void rejectsUnauthenticatedTaskDetailRequests() throws Exception {
        mockMvc.perform(get(itemPath(UUID.randomUUID(), UUID.randomUUID())))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(workflows, tenantAuthorization);
    }

    @Test
    void allowsEveryFirmMemberToListSharedWorkflowViews() throws Exception {
        UUID firmId = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, "member@example.com", MembershipRole.MEMBER);

        mockMvc.perform(get("/api/workflows/views")
                        .with(user("member@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isOk());

        verify(workflows).listSavedViews(tenant);
    }

    @Test
    void rejectsUnauthenticatedSavedViewCreationBeforeCallingApplicationService() throws Exception {
        UUID firmId = UUID.randomUUID();
        authorize(firmId, MembershipRole.OWNER);

        mockMvc.perform(post("/api/workflows/views")
                .header(TenantSelectionFilter.FIRM_HEADER, firmId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Overdue work\"}"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(workflows);
    }

    @Test
    void routesAuthenticatedSavedViewCreationForAdministrators() throws Exception {
        UUID firmId = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, MembershipRole.ADMINISTRATOR);
        when(workflows.createSavedView(eq(tenant), any())).thenReturn(new WorkflowFilterView(UUID.randomUUID(),
                "Overdue work", null, null, "OVERDUE", null, null));

        mockMvc.perform(post("/api/workflows/views")
                        .with(user("owner@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Overdue work\",\"dueState\":\"OVERDUE\"}"))
                .andExpect(status().isCreated());

        verify(workflows).createSavedView(eq(tenant), any());
    }

    @Test
    void mapsUnauthorizedSavedViewManagementToForbidden() throws Exception {
        UUID firmId = UUID.randomUUID();
        UUID viewId = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, "member@example.com", MembershipRole.MEMBER);
        doThrow(new AccessDeniedException("Only owners and administrators can manage shared workflow views"))
                .when(workflows).deleteSavedView(tenant, viewId);

        mockMvc.perform(delete("/api/workflows/views/" + viewId)
                        .with(user("member@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isForbidden());
    }

    @Test
    void mapsAnotherFirmsSavedViewToNotFound() throws Exception {
        UUID firmId = UUID.randomUUID();
        UUID viewId = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, MembershipRole.OWNER);
        doThrow(new WorkNotFoundException("Saved workflow view was not found in the selected firm"))
                .when(workflows).deleteSavedView(tenant, viewId);

        mockMvc.perform(delete("/api/workflows/views/" + viewId)
                        .with(user("owner@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsMissingSelectedFirmForTaskDetailRequests() throws Exception {
        mockMvc.perform(get(itemPath(UUID.randomUUID(), UUID.randomUUID()))
                        .with(user("member@example.com")))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(workflows, tenantAuthorization);
    }

    @Test
    void rejectsUsersWithoutSelectedFirmMembershipBeforeTaskDetailLookup() throws Exception {
        UUID firmId = UUID.randomUUID();
        when(tenantAuthorization.authorize("member@example.com", firmId))
                .thenThrow(new AccessDeniedException("User is not a member of this firm"));

        mockMvc.perform(get(itemPath(UUID.randomUUID(), UUID.randomUUID()))
                        .with(user("member@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isForbidden());

        verifyNoInteractions(workflows);
    }

    @Test
    void rejectsUnauthenticatedReviewerAssignmentBeforeCallingTheApplicationService() throws Exception {
        UUID firmId = UUID.randomUUID();
        authorize(firmId, MembershipRole.OWNER);

        mockMvc.perform(put(itemPath(UUID.randomUUID(), UUID.randomUUID()) + "/reviewer")
                .header(TenantSelectionFilter.FIRM_HEADER, firmId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(workflows);
    }

    @Test
    void allowsAuthenticatedReviewerAssignmentForOwners() throws Exception {
        UUID firmId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, MembershipRole.OWNER);

        mockMvc.perform(put(itemPath(workflowId, itemId) + "/reviewer")
                        .with(user("owner@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isOk());

        verify(workflows).assignReviewer(eq(tenant), eq(workflowId), eq(itemId), any());
    }

    @Test
    void rejectsReadOnlyMembersFromDocumentLinkMutations() throws Exception {
        UUID firmId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        SelectedTenant tenant = tenant(firmId, MembershipRole.READ_ONLY);
        when(tenantAuthorization.authorize("readonly@example.com", firmId)).thenReturn(tenant);
        doThrow(new AccessDeniedException("Only owners and administrators can assign work items"))
                .when(workflows).linkDocumentRequest(tenant, workflowId, itemId, requestId);

        mockMvc.perform(put(itemPath(workflowId, itemId) + "/document-requests/" + requestId)
                        .with(user("readonly@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsManagersFromReviewerAssignment() throws Exception {
        UUID firmId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        SelectedTenant tenant = tenant(firmId, MembershipRole.MANAGER);
        when(tenantAuthorization.authorize("manager@example.com", firmId)).thenReturn(tenant);
        doThrow(new AccessDeniedException("Only owners and administrators can assign work items"))
                .when(workflows).assignReviewer(eq(tenant), eq(workflowId), eq(itemId), any());

        mockMvc.perform(put(itemPath(workflowId, itemId) + "/reviewer")
                        .with(user("manager@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void returnsNotFoundForTaskDetailsOutsideTheSelectedFirm() throws Exception {
        UUID firmId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, "member@example.com", MembershipRole.MEMBER);
        when(workflows.getItemDetail(tenant, workflowId, itemId))
                .thenThrow(new WorkNotFoundException("Work item was not found in the selected workflow"));

        mockMvc.perform(get(itemPath(workflowId, itemId))
                        .with(user("member@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isNotFound());
    }

    @Test
    void returnsNotFoundForPublicWorkflowValuesOutsideTheSelectedFirm() throws Exception {
        UUID firmId = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, "member@example.com", MembershipRole.MEMBER);
        doThrow(new WorkNotFoundException("Workflow was not found in the selected firm"))
                .when(workflows).getBoard(tenant, "other-firm-workflow");

        mockMvc.perform(get("/api/workflows/public/other-firm-workflow")
                        .with(user("member@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isNotFound());

        verify(workflows).getBoard(tenant, "other-firm-workflow");
    }

    @Test
    void returnsNotFoundWhenLinkingARequestForAnotherClient() throws Exception {
        UUID firmId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, MembershipRole.ADMINISTRATOR);
        when(workflows.linkDocumentRequest(tenant, workflowId, itemId, requestId))
                .thenThrow(new WorkNotFoundException("Document request was not found for this work item's client"));

        mockMvc.perform(put(itemPath(workflowId, itemId) + "/document-requests/" + requestId)
                        .with(user("owner@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isNotFound());
    }

    @Test
    void returnsNotFoundWhenUnlinkingARequestFromAnotherFirm() throws Exception {
        UUID firmId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        SelectedTenant tenant = authorize(firmId, MembershipRole.ADMINISTRATOR);
        when(workflows.unlinkDocumentRequest(tenant, workflowId, itemId, requestId))
                .thenThrow(new WorkNotFoundException("Document request link was not found in the selected work item"));

        mockMvc.perform(delete(itemPath(workflowId, itemId) + "/document-requests/" + requestId)
                        .with(user("owner@example.com"))
                        .header(TenantSelectionFilter.FIRM_HEADER, firmId))
                .andExpect(status().isNotFound());
    }

    private SelectedTenant authorize(UUID firmId, MembershipRole role) {
        return authorize(firmId, "owner@example.com", role);
    }

    private SelectedTenant authorize(UUID firmId, String email, MembershipRole role) {
        SelectedTenant tenant = tenant(firmId, email, role);
        when(tenantAuthorization.authorize(email, firmId)).thenReturn(tenant);
        return tenant;
    }

    private SelectedTenant tenant(UUID firmId, MembershipRole role) {
        return tenant(firmId, "owner@example.com", role);
    }

    private SelectedTenant tenant(UUID firmId, String email, MembershipRole role) {
        return new SelectedTenant(firmId, UUID.randomUUID(), email, role);
    }

    private String itemPath(UUID workflowId, UUID itemId) {
        return "/api/workflows/" + workflowId + "/items/" + itemId;
    }
}
