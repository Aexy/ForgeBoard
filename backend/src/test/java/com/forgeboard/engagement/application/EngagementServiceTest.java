package com.forgeboard.engagement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.forgeboard.client.ClientDirectory;
import com.forgeboard.engagement.domain.EngagementTemplate;
import com.forgeboard.engagement.domain.EngagementTemplateEnrollment;
import com.forgeboard.engagement.domain.EngagementTemplateVersion;
import com.forgeboard.engagement.domain.Recurrence;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateEnrollmentRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateVersionRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.work.WorkflowDirectory;

@ExtendWith(MockitoExtension.class)
class EngagementServiceTest {
    @Mock EngagementTemplateRepository templates;
    @Mock EngagementTemplateVersionRepository templateVersions;
    @Mock EngagementTemplateEnrollmentRepository enrollments;
    @Mock EngagementRepository engagements;
    @Mock WorkflowDirectory workflows;
    @Mock ClientDirectory clients;
    @Mock ActivityRecorder activity;
    EngagementService service;
    SelectedTenant tenant;
    Instant now;

    @BeforeEach
    void setUp() {
        now = Instant.parse("2026-07-13T09:00:00Z");
        tenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "owner@example.com", MembershipRole.OWNER);
        service = new EngagementService(templates, templateVersions, enrollments, engagements,
                mock(com.forgeboard.engagement.persistence.EngagementReviewDecisionRepository.class), workflows, clients,
                activity, Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void createsTenantScopedTemplateAndRecordsAuditEvent() {
        UUID workflowId = UUID.randomUUID();
        when(workflows.exists(tenant.firmId(), workflowId)).thenReturn(true);
        when(templates.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        EngagementTemplateView template = service.createTemplate(tenant,
                new EngagementTemplateRequest("Monthly bookkeeping", workflowId, Recurrence.MONTHLY, "Bookkeeping {{period}}", 20));

        assertThat(template.name()).isEqualTo("Monthly bookkeeping");
        verify(activity).recordRestUserAction(any(), any(), any(), any(), any(), any());
    }

    @Test
    void rejectsDuplicateTemplateNameBeforeSaving() {
        UUID workflowId = UUID.randomUUID();
        when(workflows.exists(tenant.firmId(), workflowId)).thenReturn(true);
        when(templates.existsByFirmIdAndName(tenant.firmId(), "Monthly bookkeeping")).thenReturn(true);

        assertThatThrownBy(() -> service.createTemplate(tenant,
                new EngagementTemplateRequest(" Monthly bookkeeping ", workflowId, Recurrence.MONTHLY,
                        "Bookkeeping {{period}}", 20)))
                .isInstanceOf(EngagementAlreadyExistsException.class)
                .hasMessage("An engagement template with this name already exists");

        verifyNoInteractions(activity);
    }

    @Test
    void createsDefinitionVersionOneAndAllowsManagerToCreateVersionTwo() {
        UUID templateId = UUID.randomUUID(); UUID workflowId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), workflowId,
                "Monthly bookkeeping", Recurrence.MONTHLY, "Bookkeeping {{period}}", 20, now);
        when(templates.findByIdAndFirmId(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        when(workflows.exists(tenant.firmId(), workflowId)).thenReturn(true);

        EngagementTemplateView updated = service.updateTemplate(
                new SelectedTenant(tenant.firmId(), tenant.userId(), "manager@example.com", MembershipRole.MANAGER), templateId,
                new UpdateEngagementTemplateRequest("VAT returns", workflowId, Recurrence.QUARTERLY, "VAT {{period}}", 19, 0));

        assertThat(updated.currentVersion()).isEqualTo(2);
        ArgumentCaptor<EngagementTemplateVersion> snapshot = ArgumentCaptor.forClass(EngagementTemplateVersion.class);
        verify(templateVersions).save(snapshot.capture());
        assertThat(snapshot.getValue().definitionVersion()).isEqualTo(2);
        verify(activity).recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-template.updated",
                "engagement-template", templateId, java.util.Map.of("version", 2));
    }

    @Test
    void deniesMembersTemplateManagementAndRejectsStaleUpdatesBeforeAudit() {
        UUID templateId = UUID.randomUUID(); UUID workflowId = UUID.randomUUID();
        SelectedTenant member = new SelectedTenant(tenant.firmId(), tenant.userId(), "member@example.com", MembershipRole.MEMBER);
        assertThatThrownBy(() -> service.updateTemplate(member, templateId,
                new UpdateEngagementTemplateRequest("VAT", workflowId, Recurrence.MONTHLY, "VAT", 20, 1)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);

        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), workflowId,
                "Monthly bookkeeping", Recurrence.MONTHLY, "Bookkeeping {{period}}", 20, now);
        template.advanceDefinition("Monthly bookkeeping", workflowId, Recurrence.MONTHLY, "Bookkeeping {{period}}", 20, now);
        when(templates.findByIdAndFirmId(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        assertThatThrownBy(() -> service.updateTemplate(tenant, templateId,
                new UpdateEngagementTemplateRequest("VAT", workflowId, Recurrence.MONTHLY, "VAT", 20, 1)))
                .isInstanceOf(EngagementAlreadyExistsException.class);
        verifyNoInteractions(activity);
    }

    @Test
    void retainsTemplateDefinitionVersionOnExistingEngagement() {
        UUID templateId = UUID.randomUUID(); UUID workflowId = UUID.randomUUID(); UUID clientId = UUID.randomUUID(); UUID workItemId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), workflowId,
                "Monthly bookkeeping", Recurrence.MONTHLY, "Bookkeeping {{period}}", 20, now);
        when(templates.findByIdAndFirmId(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        when(enrollments.existsByFirmIdAndTemplateIdAndClientId(tenant.firmId(), templateId, clientId)).thenReturn(true);
        when(clients.existsActive(tenant.firmId(), clientId)).thenReturn(true);
        when(workflows.createInitialWorkItem(any(), any(), any(), any(), any(), any(), any())).thenReturn(workItemId);
        when(engagements.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        EngagementView created = service.createEngagement(tenant, templateId, new CreateEngagementRequest(clientId, LocalDate.of(2026, 7, 1)));

        template.advanceDefinition("VAT", workflowId, Recurrence.MONTHLY, "VAT {{period}}", 20, now.plusSeconds(1));

        ArgumentCaptor<com.forgeboard.engagement.domain.Engagement> engagement = ArgumentCaptor.forClass(com.forgeboard.engagement.domain.Engagement.class);
        verify(engagements).save(engagement.capture());
        assertThat(created.templateVersion()).isEqualTo(1);
        assertThat(engagement.getValue().templateVersion()).isEqualTo(1);
    }

    @Test
    void enrollsAndUnenrollsOnlyValidatedActiveClientsIdempotently() {
        UUID templateId = UUID.randomUUID(); UUID firstId = UUID.randomUUID(); UUID secondId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), UUID.randomUUID(),
                "Monthly bookkeeping", Recurrence.MONTHLY, "Bookkeeping {{period}}", 20, now);
        ClientDirectory.ActiveClient active = activeClient(firstId);
        when(templates.findByIdAndFirmIdForUpdate(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        when(clients.findActiveByIds(tenant.firmId(), List.of(firstId))).thenReturn(List.of(active));
        when(enrollments.findAllByFirmIdAndTemplateIdAndClientIdIn(tenant.firmId(), templateId, List.of(firstId))).thenReturn(List.of());
        EngagementTemplateEnrollment enrollment = new EngagementTemplateEnrollment(UUID.randomUUID(), tenant.firmId(), templateId,
                firstId, tenant.userId(), now);
        when(enrollments.findAllByFirmIdAndTemplateId(tenant.firmId(), templateId)).thenReturn(List.of(enrollment));

        TemplateEnrollmentView result = service.enrollClients(tenant, templateId, new TemplateEnrollmentRequest(List.of(firstId)));

        assertThat(result.enrolledClientCount()).isEqualTo(1);
        verify(enrollments).saveAll(any());
        verify(activity).recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-template.clients-enrolled",
                "engagement-template", templateId, java.util.Map.of("addedCount", 1));

        when(clients.findActiveByIds(tenant.firmId(), List.of(secondId))).thenReturn(List.of());
        assertThatThrownBy(() -> service.unenrollClients(tenant, templateId, new TemplateEnrollmentRequest(List.of(secondId))))
                .isInstanceOf(EngagementNotFoundException.class);
        verifyNoInteractions(templateVersions);
    }

    @Test
    void rejectsInvalidEnrollmentBatchesWithoutAnyMutationOrAudit() {
        UUID templateId = UUID.randomUUID(); UUID activeId = UUID.randomUUID(); UUID foreignId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), UUID.randomUUID(),
                "Monthly bookkeeping", Recurrence.MONTHLY, "Bookkeeping {{period}}", 20, now);
        when(templates.findByIdAndFirmIdForUpdate(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        when(clients.findActiveByIds(tenant.firmId(), List.of(activeId, foreignId))).thenReturn(List.of(activeClient(activeId)));

        assertThatThrownBy(() -> service.enrollClients(tenant, templateId,
                new TemplateEnrollmentRequest(List.of(activeId, foreignId))))
                .isInstanceOf(EngagementNotFoundException.class);

        verify(enrollments, org.mockito.Mockito.never()).saveAll(any());
        verify(activity, org.mockito.Mockito.never()).recordRestUserAction(any(), any(), any(), any(), any(), any());
    }

    @Test
    void treatsRepeatedAddsAndAbsentRemovesAsIdempotent() {
        UUID templateId = UUID.randomUUID(); UUID clientId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), UUID.randomUUID(),
                "Monthly bookkeeping", Recurrence.MONTHLY, "Bookkeeping {{period}}", 20, now);
        when(templates.findByIdAndFirmIdForUpdate(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        when(clients.findActiveByIds(tenant.firmId(), List.of(clientId))).thenReturn(List.of(activeClient(clientId)));
        EngagementTemplateEnrollment existing = new EngagementTemplateEnrollment(UUID.randomUUID(), tenant.firmId(), templateId,
                clientId, tenant.userId(), now);
        when(enrollments.findAllByFirmIdAndTemplateIdAndClientIdIn(tenant.firmId(), templateId, List.of(clientId)))
                .thenReturn(List.of(existing), List.of());
        when(enrollments.findAllByFirmIdAndTemplateId(tenant.firmId(), templateId)).thenReturn(List.of(existing));

        assertThat(service.enrollClients(tenant, templateId, new TemplateEnrollmentRequest(List.of(clientId))).enrolledClientCount())
                .isEqualTo(1);
        assertThat(service.unenrollClients(tenant, templateId, new TemplateEnrollmentRequest(List.of(clientId))).enrolledClientCount())
                .isEqualTo(1);
        verify(enrollments, org.mockito.Mockito.never()).saveAll(any());
        verify(enrollments, org.mockito.Mockito.never()).deleteAll(any());
    }

    @Test
    void createsQuarterlyEngagementWithNormalizedPeriodAndDueDate() {
        UUID templateId = UUID.randomUUID(); UUID workflowId = UUID.randomUUID(); UUID clientId = UUID.randomUUID();
        UUID workItemId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), workflowId,
                "VAT returns", Recurrence.QUARTERLY, "VAT {{period}}", 20, now);
        when(templates.findByIdAndFirmId(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        when(enrollments.existsByFirmIdAndTemplateIdAndClientId(tenant.firmId(), templateId, clientId)).thenReturn(true);
        when(clients.existsActive(tenant.firmId(), clientId)).thenReturn(true);
        when(workflows.createInitialWorkItem(eq(tenant.firmId()), eq(clientId), eq(workflowId), any(), any(), any(), any()))
                .thenReturn(workItemId);
        when(engagements.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        EngagementView engagement = service.createEngagement(tenant, templateId,
                new CreateEngagementRequest(clientId, LocalDate.of(2026, 5, 13)));

        assertThat(engagement.periodStart()).isEqualTo(LocalDate.of(2026, 4, 1));
        assertThat(engagement.periodEnd()).isEqualTo(LocalDate.of(2026, 6, 30));
        assertThat(engagement.dueDate()).isEqualTo(LocalDate.of(2026, 6, 20));
        assertThat(engagement.workItemId()).isEqualTo(workItemId);
        ArgumentCaptor<String> title = ArgumentCaptor.forClass(String.class);
        verify(workflows).createInitialWorkItem(eq(tenant.firmId()), eq(clientId), eq(workflowId), title.capture(),
                eq("Generated from VAT returns for Apr 1, 2026 to Jun 30, 2026."),
                eq(LocalDate.of(2026, 6, 20)), eq(now));
        assertThat(title.getValue()).isEqualTo("VAT Q2 2026");
    }

    @Test
    void rejectsTemplateFromAnotherFirm() {
        UUID templateId = UUID.randomUUID();
        when(templates.findByIdAndFirmId(templateId, tenant.firmId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createEngagement(tenant, templateId,
                new CreateEngagementRequest(UUID.randomUUID(), LocalDate.of(2026, 7, 1))))
                .isInstanceOf(EngagementNotFoundException.class);
    }

    @Test
    void rejectsDuplicateEngagementBeforeCreatingBoardWork() {
        UUID templateId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), workflowId,
                "Monthly bookkeeping", Recurrence.MONTHLY, "Bookkeeping {{period}}", 20, now);
        when(templates.findByIdAndFirmId(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        when(enrollments.existsByFirmIdAndTemplateIdAndClientId(tenant.firmId(), templateId, clientId)).thenReturn(true);
        when(clients.existsActive(tenant.firmId(), clientId)).thenReturn(true);
        when(engagements.existsByFirmIdAndTemplateIdAndClientIdAndPeriodStart(
                tenant.firmId(), templateId, clientId, LocalDate.of(2026, 7, 1))).thenReturn(true);

        assertThatThrownBy(() -> service.createEngagement(tenant, templateId,
                new CreateEngagementRequest(clientId, LocalDate.of(2026, 7, 16))))
                .isInstanceOf(EngagementAlreadyExistsException.class)
                .hasMessage("An engagement already exists for this client and period");

        verifyNoInteractions(workflows);
    }

    @Test
    void rejectsManualCreationForClientsThatAreNotActivelyEnrolled() {
        UUID templateId = UUID.randomUUID(); UUID clientId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), UUID.randomUUID(),
                "Monthly bookkeeping", Recurrence.MONTHLY, "Bookkeeping {{period}}", 20, now);
        when(templates.findByIdAndFirmId(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        when(enrollments.existsByFirmIdAndTemplateIdAndClientId(tenant.firmId(), templateId, clientId)).thenReturn(false);

        assertThatThrownBy(() -> service.createEngagement(tenant, templateId,
                new CreateEngagementRequest(clientId, LocalDate.of(2026, 7, 1))))
                .isInstanceOf(EngagementNotFoundException.class)
                .hasMessage("Client is not enrolled in this engagement template");
        verifyNoInteractions(workflows);
    }

    private ClientDirectory.ActiveClient activeClient(UUID id) {
        return new ClientDirectory.ActiveClient(id, "Northstar GmbH", "Northstar", null, 0);
    }
}
