package com.forgeboard.engagement.application;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.calendar.FirmBusinessCalendar;
import com.forgeboard.client.ClientDirectory;
import com.forgeboard.engagement.domain.EngagementRecurrenceRun;
import com.forgeboard.engagement.domain.EngagementTemplate;
import com.forgeboard.engagement.domain.EngagementTemplateEnrollment;
import com.forgeboard.engagement.domain.RecurrenceRunStatus;
import com.forgeboard.engagement.persistence.EngagementRecurrenceRunRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateEnrollmentRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateRepository;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.ActivityRecorder;

@Service
public class RecurrenceFailureService {
    private final EngagementRecurrenceRunRepository runs;
    private final EngagementTemplateRepository templates;
    private final EngagementTemplateEnrollmentRepository enrollments;
    private final ClientDirectory clients;
    private final EngagementMaterializer materializer;
    private final FirmBusinessCalendar businessDays;
    private final ActivityRecorder audit;
    private final Clock clock;

    public RecurrenceFailureService(EngagementRecurrenceRunRepository runs, EngagementTemplateRepository templates,
            EngagementTemplateEnrollmentRepository enrollments, ClientDirectory clients, EngagementMaterializer materializer,
            FirmBusinessCalendar businessDays, ActivityRecorder audit, Clock clock) {
        this.runs = runs; this.templates = templates; this.enrollments = enrollments; this.clients = clients;
        this.materializer = materializer; this.businessDays = businessDays; this.audit = audit; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<RecurrenceFailureView> list(SelectedTenant tenant) {
        requireOwner(tenant);
        return runs.findAllByFirmIdAndStatusOrderByUpdatedAtAsc(tenant.firmId(), RecurrenceRunStatus.FAILED).stream()
                .map(run -> view(tenant.firmId(), run)).toList();
    }

    @Transactional
    public RecurrenceFailureView retry(SelectedTenant tenant, UUID runId) {
        requireOwner(tenant);
        EngagementRecurrenceRun run = requireFailed(tenant.firmId(), runId);
        try {
            int generated = materialize(tenant.firmId(), run);
            run.succeed(generated, clock.instant());
            audit.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-recurrence.retried",
                    "engagement-recurrence-run", run.id(), Map.of("generatedCount", generated));
        } catch (RuntimeException failure) {
            run.recordAutomaticRetryAttempt(clock.instant());
            audit.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-recurrence.retry-failed",
                    "engagement-recurrence-run", run.id(), Map.of());
            // The failed attempt is intentional operational state: retain it so an owner can use Generate now or Mark solved.
            return view(tenant.firmId(), run);
        }
        return view(tenant.firmId(), run);
    }

    @Transactional
    public void markSolved(SelectedTenant tenant, UUID runId) {
        requireOwner(tenant);
        EngagementRecurrenceRun run = requireFailed(tenant.firmId(), runId);
        run.resolve(clock.instant());
        audit.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-recurrence.resolved",
                "engagement-recurrence-run", run.id(), Map.of("resolution", "marked-solved"));
    }

    @Transactional
    public RecurrenceFailureView generateNow(SelectedTenant tenant, UUID runId) {
        requireOwner(tenant);
        EngagementRecurrenceRun run = requireFailed(tenant.firmId(), runId);
        EngagementTemplate template = templates.findByIdAndFirmIdForUpdate(run.templateId(), tenant.firmId())
                .orElseThrow(() -> new EngagementNotFoundException("Engagement template was not found in the selected firm"));
        if (template.currentVersion() != run.definitionVersion() && !run.automaticRetryAttempted())
            throw new IllegalStateException("Retry once before generating from the updated template definition");
        int generated = materialize(tenant.firmId(), run);
        run.succeed(generated, clock.instant());
        audit.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-recurrence.generated",
                "engagement-recurrence-run", run.id(), Map.of("generatedCount", generated));
        return view(tenant.firmId(), run);
    }

    /** The scheduled path retries each failed run exactly once after its fifteen-minute quiet period. */
    @Transactional
    public void retryEligibleAutomatically() {
        Instant threshold = clock.instant().minusSeconds(15 * 60);
        for (EngagementRecurrenceRun run : runs.findAllByStatusAndAutomaticRetryAttemptedFalseAndUpdatedAtLessThanEqual(RecurrenceRunStatus.FAILED, threshold)) {
            run.recordAutomaticRetryAttempt(clock.instant());
            try {
                int generated = materialize(run.firmId(), run);
                run.succeed(generated, clock.instant());
                audit.recordSystemAction(run.firmId(), "engagement-recurrence.auto-retry-succeeded", "engagement-recurrence-run", run.id(), Map.of("generatedCount", generated));
            } catch (RuntimeException ignored) {
                audit.recordSystemAction(run.firmId(), "engagement-recurrence.auto-retry-failed", "engagement-recurrence-run", run.id(), Map.of());
            }
        }
    }

    private int materialize(UUID firmId, EngagementRecurrenceRun run) {
        EngagementTemplate template = templates.findByIdAndFirmIdForUpdate(run.templateId(), firmId)
                .orElseThrow(() -> new EngagementNotFoundException("Engagement template was not found in the selected firm"));
        List<UUID> enrolled = enrollments.findAllByFirmIdAndTemplateId(firmId, template.id()).stream().map(EngagementTemplateEnrollment::clientId).toList();
        LocalDate periodEnd = materializer.periodEnd(run.periodStart(), template.recurrence());
        LocalDate due = businessDays.precedingBusinessDay(firmId, periodEnd.withDayOfMonth(Math.min(template.dueDay(), periodEnd.lengthOfMonth())));
        int count = 0;
        for (ClientDirectory.ActiveClient client : clients.findActiveByIds(firmId, enrolled)) {
            if (materializer.materialize(firmId, client.id(), EngagementDefinition.current(template), run.periodStart(), due, clock.instant()).created()) count++;
        }
        return count;
    }

    private EngagementRecurrenceRun requireFailed(UUID firmId, UUID runId) {
        EngagementRecurrenceRun run = runs.findByIdAndFirmId(runId, firmId).orElseThrow(() -> new EngagementNotFoundException("Recurrence failure was not found in the selected firm"));
        if (run.status() != RecurrenceRunStatus.FAILED) throw new IllegalStateException("This recurrence failure has already been resolved");
        return run;
    }
    private RecurrenceFailureView view(UUID firmId, EngagementRecurrenceRun run) {
        EngagementTemplate template = templates.findByIdAndFirmId(run.templateId(), firmId)
                .orElseThrow(() -> new EngagementNotFoundException("Engagement template was not found in the selected firm"));
        return new RecurrenceFailureView(run.id(), run.templateId(), template.name(), run.periodStart(), run.definitionVersion(), template.currentVersion(),
                run.failureDetail(), run.automaticRetryAttempted(), template.currentVersion() != run.definitionVersion() && !run.automaticRetryAttempted());
    }
    private void requireOwner(SelectedTenant tenant) { if (!tenant.isOwner()) throw new AccessDeniedException("Only owners can recover recurrence failures"); }
}
