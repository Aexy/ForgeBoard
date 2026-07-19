package com.forgeboard.work.application;

import static org.mockito.Mockito.mock;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import com.forgeboard.client.ClientDirectory;
import com.forgeboard.document.DocumentRequestDirectory;
import com.forgeboard.identity.ActivityDirectory;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.EmployeeDirectory;
import com.forgeboard.identity.FirmDirectory;
import com.forgeboard.identity.MembershipAccess;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.work.persistence.SavedWorkflowViewRepository;
import com.forgeboard.work.persistence.WorkItemAssignmentRepository;
import com.forgeboard.work.persistence.WorkItemDocumentRequestRepository;
import com.forgeboard.work.persistence.WorkItemRepository;
import com.forgeboard.work.persistence.WorkflowRepository;
import com.forgeboard.work.persistence.WorkflowStageRepository;

final class WorkflowServiceFixture {
    final WorkflowRepository workflows = mock(WorkflowRepository.class);
    final WorkflowStageRepository stages = mock(WorkflowStageRepository.class);
    final WorkItemRepository items = mock(WorkItemRepository.class);
    final ClientDirectory clients = mock(ClientDirectory.class);
    final ActivityRecorder activity = mock(ActivityRecorder.class);
    final MembershipAccess membershipAccess = mock(MembershipAccess.class);
    final WorkItemAssignmentRepository assignments = mock(WorkItemAssignmentRepository.class);
    final EmployeeDirectory employees = mock(EmployeeDirectory.class);
    final DocumentRequestDirectory documentRequests = mock(DocumentRequestDirectory.class);
    final WorkItemDocumentRequestRepository documentLinks = mock(WorkItemDocumentRequestRepository.class);
    final ActivityDirectory activityQueries = mock(ActivityDirectory.class);
    final SavedWorkflowViewRepository savedViews = mock(SavedWorkflowViewRepository.class);
    final FirmDirectory firms = mock(FirmDirectory.class);
    final SelectedTenant tenant;
    private final WorkflowBoardReader reader;
    private final WorkflowService service;

    WorkflowServiceFixture(Instant now) {
        tenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "owner@example.com", MembershipRole.OWNER);
        reader = new WorkflowBoardReader(workflows, stages, items, clients, assignments, employees, documentRequests,
                documentLinks, activityQueries);
        service = new WorkflowService(workflows, stages, items, clients, activity, Clock.fixed(now, ZoneOffset.UTC),
                membershipAccess, assignments, documentRequests, documentLinks, savedViews, firms, reader);
    }

    WorkflowService service() {
        return service;
    }

    WorkflowBoardReader reader() {
        return reader;
    }
}
