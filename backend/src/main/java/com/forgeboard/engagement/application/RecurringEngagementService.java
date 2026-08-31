package com.forgeboard.engagement.application;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.calendar.FirmBusinessCalendar;
import com.forgeboard.client.ClientDirectory;
import com.forgeboard.engagement.domain.EngagementRecurrenceRun;
import com.forgeboard.engagement.domain.EngagementTemplate;
import com.forgeboard.engagement.domain.EngagementTemplateEnrollment;
import com.forgeboard.engagement.persistence.EngagementRecurrenceRunRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateEnrollmentRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.FirmDirectory;

@Service
public class RecurringEngagementService {
    private static final ZoneId VIENNA = ZoneId.of("Europe/Vienna");
    private final FirmDirectory firms;
    private final EngagementTemplateRepository templates;
    private final EngagementTemplateEnrollmentRepository enrollments;
    private final EngagementRecurrenceRunRepository runs;
    private final ClientDirectory clients;
    private final FirmBusinessCalendar businessDays;
    private final EngagementMaterializer materializer;
    private final ActivityRecorder audit;
    private final Clock clock;

    public RecurringEngagementService(FirmDirectory firms, EngagementTemplateRepository templates,
            EngagementTemplateEnrollmentRepository enrollments, EngagementRecurrenceRunRepository runs,
            ClientDirectory clients, FirmBusinessCalendar businessDays, EngagementMaterializer materializer,
            ActivityRecorder audit, Clock clock) {
        this.firms = firms; this.templates = templates; this.enrollments = enrollments; this.runs = runs;
        this.clients = clients; this.businessDays = businessDays; this.materializer = materializer; this.audit = audit; this.clock = clock;
    }

    /** Executes only the current local firm's canonical first-business-day period. */
    @Transactional
    public void runDaily() {
        for (UUID firmId : firms.activeFirmIds()) runForFirm(firmId);
    }

    @Transactional
    public int runForFirm(UUID firmId) {
        LocalDate today = LocalDate.now(clock.withZone(VIENNA));
        int generated = 0;
        for (EngagementTemplate definition : templates.findAllByFirmIdOrderByNameAsc(firmId)) {
            generated += generateTemplateIfDue(firmId, definition.id(), today);
        }
        return generated;
    }

    @Transactional
    int generateTemplateIfDue(UUID firmId, UUID templateId, LocalDate today) {
        EngagementTemplate template = templates.findByIdAndFirmIdForUpdate(templateId, firmId).orElseThrow();
        LocalDate currentPeriodStart = materializer.normalizedPeriodStart(today, template.recurrence());
        LocalDate previousPeriodStart = switch (template.recurrence()) {
            case MONTHLY -> currentPeriodStart.minusMonths(1);
            case QUARTERLY -> currentPeriodStart.minusMonths(3);
            case ANNUAL -> currentPeriodStart.minusYears(1);
        };
        LocalDate periodEnd = materializer.periodEnd(previousPeriodStart, template.recurrence());
        if (!today.equals(businessDays.firstBusinessDayOnOrAfter(firmId, periodEnd.plusDays(1)))) return 0;
        if (runs.existsByFirmIdAndTemplateIdAndPeriodStart(firmId, template.id(), previousPeriodStart)) return 0;
        try {
            List<UUID> enrollmentIds = enrollments.findAllByFirmIdAndTemplateId(firmId, template.id()).stream()
                    .map(EngagementTemplateEnrollment::clientId).toList();
            List<UUID> activeClients = clients.findActiveByIds(firmId, enrollmentIds).stream().map(ClientDirectory.ActiveClient::id).toList();
            LocalDate due = businessDays.precedingBusinessDay(firmId,
                    periodEnd.withDayOfMonth(Math.min(template.dueDay(), periodEnd.lengthOfMonth())));
            Instant now = clock.instant(); int createdCount = 0;
            for (UUID clientId : activeClients) {
                EngagementMaterializer.MaterializedEngagement created = materializer.materialize(firmId, clientId,
                        EngagementDefinition.current(template), previousPeriodStart, due, now);
                if (created.created()) {
                    createdCount++;
                    audit.recordSystemAction(firmId, "work-item.created", "work-item", created.engagement().workItemId(),
                            java.util.Map.of("source", "recurrence", "templateId", template.id().toString()));
                    audit.recordSystemAction(firmId, "engagement.created", "engagement", created.engagement().id(),
                            java.util.Map.of("source", "recurrence", "templateId", template.id().toString(),
                                    "periodStart", previousPeriodStart.toString(), "dueDate", due.toString()));
                }
            }
            runs.save(new EngagementRecurrenceRun(UUID.randomUUID(), firmId, template.id(), previousPeriodStart,
                    template.currentVersion(), today, createdCount, now));
            audit.recordSystemAction(firmId, "engagement-recurrence.succeeded", "engagement-template", template.id(),
                    java.util.Map.of("periodStart", previousPeriodStart.toString(), "generatedCount", createdCount));
            return createdCount;
        } catch (RuntimeException failure) {
            Instant now = clock.instant();
            runs.save(EngagementRecurrenceRun.failed(UUID.randomUUID(), firmId, template.id(), previousPeriodStart,
                    template.currentVersion(), today, failure.getMessage(), now));
            audit.recordSystemAction(firmId, "engagement-recurrence.failed", "engagement-template", template.id(),
                    java.util.Map.of("periodStart", previousPeriodStart.toString()));
            return 0;
        }
    }
}
