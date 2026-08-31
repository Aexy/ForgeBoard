package com.forgeboard.engagement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.forgeboard.calendar.FirmBusinessCalendar;
import com.forgeboard.client.ClientDirectory;
import com.forgeboard.engagement.domain.Engagement;
import com.forgeboard.engagement.domain.EngagementTemplate;
import com.forgeboard.engagement.domain.EngagementTemplateEnrollment;
import com.forgeboard.engagement.domain.Recurrence;
import com.forgeboard.engagement.persistence.EngagementRecurrenceRunRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateEnrollmentRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.FirmDirectory;

@ExtendWith(MockitoExtension.class)
class RecurringEngagementServiceTest {
    @Mock FirmDirectory firms;
    @Mock EngagementTemplateRepository templates;
    @Mock EngagementTemplateEnrollmentRepository enrollments;
    @Mock EngagementRecurrenceRunRepository runs;
    @Mock ClientDirectory clients;
    @Mock FirmBusinessCalendar businessDays;
    @Mock EngagementMaterializer materializer;
    @Mock ActivityRecorder audit;
    private RecurringEngagementService service;
    private UUID firmId;
    private UUID templateId;

    @BeforeEach
    void setUp() {
        firmId = UUID.randomUUID(); templateId = UUID.randomUUID();
        service = new RecurringEngagementService(firms, templates, enrollments, runs, clients, businessDays,
                materializer, audit, Clock.fixed(Instant.parse("2026-08-03T08:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void generatesOnlyThePreviousMonthlyPeriodOnItsFirstBusinessDayAndRecordsRun() {
        UUID clientId = UUID.randomUUID(), workItemId = UUID.randomUUID();
        EngagementTemplate template = new EngagementTemplate(templateId, firmId, UUID.randomUUID(), "VAT",
                Recurrence.MONTHLY, "VAT {{period}}", 2, Instant.parse("2026-01-01T00:00:00Z"));
        Engagement engagement = new Engagement(UUID.randomUUID(), firmId, templateId, 1, clientId, template.workflowId(),
                workItemId, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31), LocalDate.of(2026, 7, 2), Instant.now());
        when(templates.findByIdAndFirmIdForUpdate(templateId, firmId)).thenReturn(Optional.of(template));
        when(materializer.normalizedPeriodStart(LocalDate.of(2026, 8, 3), Recurrence.MONTHLY)).thenReturn(LocalDate.of(2026, 8, 1));
        when(materializer.periodEnd(LocalDate.of(2026, 7, 1), Recurrence.MONTHLY)).thenReturn(LocalDate.of(2026, 7, 31));
        when(businessDays.firstBusinessDayOnOrAfter(firmId, LocalDate.of(2026, 8, 1))).thenReturn(LocalDate.of(2026, 8, 3));
        when(enrollments.findAllByFirmIdAndTemplateId(firmId, templateId)).thenReturn(List.of(
                new EngagementTemplateEnrollment(UUID.randomUUID(), firmId, templateId, clientId, UUID.randomUUID(), Instant.now())));
        when(clients.findActiveByIds(firmId, List.of(clientId))).thenReturn(List.of(
                new ClientDirectory.ActiveClient(clientId, "Northstar GmbH", "Northstar", null, 0)));
        when(businessDays.precedingBusinessDay(firmId, LocalDate.of(2026, 7, 2))).thenReturn(LocalDate.of(2026, 7, 2));
        when(materializer.materialize(eq(firmId), eq(clientId), any(), eq(LocalDate.of(2026, 7, 1)),
                eq(LocalDate.of(2026, 7, 2)), any())).thenReturn(
                        new EngagementMaterializer.MaterializedEngagement(engagement, "VAT July 2026", engagement.periodStart(), true));

        assertThat(service.generateTemplateIfDue(firmId, templateId, LocalDate.of(2026, 8, 3))).isEqualTo(1);

        verify(runs).save(any());
        verify(audit).recordSystemAction(eq(firmId), eq("engagement-recurrence.succeeded"), eq("engagement-template"),
                eq(templateId), any());
    }

    @Test
    void skipsASecondRunForTheSameTemplatePeriod() {
        EngagementTemplate template = new EngagementTemplate(templateId, firmId, UUID.randomUUID(), "VAT",
                Recurrence.MONTHLY, "VAT", 20, Instant.now());
        when(templates.findByIdAndFirmIdForUpdate(templateId, firmId)).thenReturn(Optional.of(template));
        when(materializer.normalizedPeriodStart(LocalDate.of(2026, 8, 3), Recurrence.MONTHLY)).thenReturn(LocalDate.of(2026, 8, 1));
        when(materializer.periodEnd(LocalDate.of(2026, 7, 1), Recurrence.MONTHLY)).thenReturn(LocalDate.of(2026, 7, 31));
        when(businessDays.firstBusinessDayOnOrAfter(firmId, LocalDate.of(2026, 8, 1))).thenReturn(LocalDate.of(2026, 8, 3));
        when(runs.existsByFirmIdAndTemplateIdAndPeriodStart(firmId, templateId, LocalDate.of(2026, 7, 1))).thenReturn(true);

        assertThat(service.generateTemplateIfDue(firmId, templateId, LocalDate.of(2026, 8, 3))).isZero();

        verify(enrollments, never()).findAllByFirmIdAndTemplateId(any(), any());
        verify(materializer, never()).materialize(any(), any(), any(), any(), any(), any());
    }
}
