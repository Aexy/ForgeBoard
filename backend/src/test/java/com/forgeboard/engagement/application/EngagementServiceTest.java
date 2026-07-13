package com.forgeboard.engagement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.forgeboard.client.ClientDirectory;
import com.forgeboard.engagement.domain.EngagementTemplate;
import com.forgeboard.engagement.domain.Recurrence;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.work.WorkflowDirectory;

@ExtendWith(MockitoExtension.class)
class EngagementServiceTest {
    @Mock EngagementTemplateRepository templates;
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
        service = new EngagementService(templates, engagements, workflows, clients, activity, Clock.fixed(now, ZoneOffset.UTC));
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
    void createsQuarterlyEngagementWithNormalizedPeriodAndDueDate() {
        UUID templateId = UUID.randomUUID(); UUID workflowId = UUID.randomUUID(); UUID clientId = UUID.randomUUID();
        UUID workItemId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, tenant.firmId(), workflowId,
                "VAT returns", Recurrence.QUARTERLY, "VAT {{period}}", 20, now);
        when(templates.findByIdAndFirmId(templateId, tenant.firmId())).thenReturn(Optional.of(template));
        when(clients.exists(tenant.firmId(), clientId)).thenReturn(true);
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
        when(clients.exists(tenant.firmId(), clientId)).thenReturn(true);
        when(engagements.existsByFirmIdAndTemplateIdAndClientIdAndPeriodStart(
                tenant.firmId(), templateId, clientId, LocalDate.of(2026, 7, 1))).thenReturn(true);

        assertThatThrownBy(() -> service.createEngagement(tenant, templateId,
                new CreateEngagementRequest(clientId, LocalDate.of(2026, 7, 16))))
                .isInstanceOf(EngagementAlreadyExistsException.class)
                .hasMessage("An engagement already exists for this client and period");

        verifyNoInteractions(workflows);
    }
}
