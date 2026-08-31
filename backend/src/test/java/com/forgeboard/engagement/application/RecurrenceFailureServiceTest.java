package com.forgeboard.engagement.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.forgeboard.calendar.FirmBusinessCalendar;
import com.forgeboard.client.ClientDirectory;
import com.forgeboard.engagement.domain.EngagementRecurrenceRun;
import com.forgeboard.engagement.domain.EngagementTemplate;
import com.forgeboard.engagement.domain.Recurrence;
import com.forgeboard.engagement.persistence.EngagementRecurrenceRunRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateEnrollmentRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateRepository;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.domain.MembershipRole;

@ExtendWith(MockitoExtension.class)
class RecurrenceFailureServiceTest {
    @Mock EngagementRecurrenceRunRepository runs;
    @Mock EngagementTemplateRepository templates;
    @Mock EngagementTemplateEnrollmentRepository enrollments;
    @Mock ClientDirectory clients;
    @Mock EngagementMaterializer materializer;
    @Mock FirmBusinessCalendar businessDays;
    @Mock ActivityRecorder audit;

    @Test
    void onlyOwnersCanReadRecoverableFailures() {
        RecurrenceFailureService service = service();
        SelectedTenant manager = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "manager@example.test", MembershipRole.MANAGER);
        assertThatThrownBy(() -> service.list(manager)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    void generateRequiresRetryWhenDefinitionChanged() {
        UUID firmId = UUID.randomUUID(), templateId = UUID.randomUUID(), runId = UUID.randomUUID();
        EngagementRecurrenceRun failure = EngagementRecurrenceRun.failed(runId, firmId, templateId,
                java.time.LocalDate.of(2026, 7, 1), 1, java.time.LocalDate.of(2026, 8, 3), "boom", Instant.now());
        when(runs.findByIdAndFirmId(runId, firmId)).thenReturn(java.util.Optional.of(failure));
        EngagementTemplate changed = new EngagementTemplate(templateId, firmId, UUID.randomUUID(), "VAT",
                Recurrence.MONTHLY, "Prepare VAT", 20, Instant.now());
        changed.advanceDefinition("VAT", changed.workflowId(), Recurrence.MONTHLY, "Prepare VAT", 20, Instant.now());
        when(templates.findByIdAndFirmIdForUpdate(templateId, firmId)).thenReturn(java.util.Optional.of(changed));
        SelectedTenant owner = new SelectedTenant(firmId, UUID.randomUUID(), "owner@example.test", MembershipRole.OWNER);
        assertThatThrownBy(() -> service().generateNow(owner, runId)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Retry once");
    }

    private RecurrenceFailureService service() {
        return new RecurrenceFailureService(runs, templates, enrollments, clients, materializer, businessDays, audit,
                Clock.fixed(Instant.parse("2026-08-03T08:00:00Z"), ZoneOffset.UTC));
    }
}
