package com.forgeboard.engagement.application;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.YearMonth;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.client.ClientDirectory;
import com.forgeboard.engagement.domain.Engagement;
import com.forgeboard.engagement.domain.EngagementTemplate;
import com.forgeboard.engagement.domain.Recurrence;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.WorkflowDirectory;

@Service
public class EngagementService {
    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private final EngagementTemplateRepository templates;
    private final EngagementRepository engagements;
    private final WorkflowDirectory workflows;
    private final ClientDirectory clients;
    private final ActivityRecorder activity;
    private final Clock clock;

    public EngagementService(EngagementTemplateRepository templates, EngagementRepository engagements,
            WorkflowDirectory workflows, ClientDirectory clients, ActivityRecorder activity, Clock clock) {
        this.templates = templates; this.engagements = engagements; this.workflows = workflows;
        this.clients = clients; this.activity = activity; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<EngagementTemplateView> listTemplates(SelectedTenant tenant) {
        return templates.findAllByFirmIdOrderByNameAsc(tenant.firmId()).stream().map(this::templateView).toList();
    }

    @Transactional
    public EngagementTemplateView createTemplate(SelectedTenant tenant, EngagementTemplateRequest request) {
        requireWrite(tenant);
        if (!workflows.exists(tenant.firmId(), request.workflowId()))
            throw new EngagementNotFoundException("Workflow was not found in the selected firm");
        EngagementTemplate created = templates.save(new EngagementTemplate(UUID.randomUUID(), tenant.firmId(),
                request.workflowId(), request.name().strip(), request.recurrence(), request.defaultWorkItemTitle().strip(),
                request.dueDay(), clock.instant()));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-template.created", "engagement-template",
                created.id(), Map.of("name", created.name(), "recurrence", created.recurrence().name()));
        return templateView(created);
    }

    @Transactional(readOnly = true)
    public List<EngagementView> listEngagements(SelectedTenant tenant) {
        return engagements.findAllByFirmIdOrderByDueDateAsc(tenant.firmId()).stream().map(this::engagementView).toList();
    }

    @Transactional
    public EngagementView createEngagement(SelectedTenant tenant, UUID templateId, CreateEngagementRequest request) {
        requireWrite(tenant);
        EngagementTemplate template = templates.findByIdAndFirmId(templateId, tenant.firmId())
                .orElseThrow(() -> new EngagementNotFoundException("Engagement template was not found in the selected firm"));
        if (!clients.exists(tenant.firmId(), request.clientId()))
            throw new EngagementNotFoundException("Client was not found in the selected firm");
        LocalDate periodStart = normalizedPeriodStart(request.periodStart(), template.recurrence());
        LocalDate periodEnd = periodEnd(periodStart, template.recurrence());
        LocalDate dueDate = YearMonth.from(periodEnd).atDay(Math.min(template.dueDay(), periodEnd.lengthOfMonth()));
        String workItemTitle = workItemTitle(template, periodStart);
        UUID workItemId = workflows.createInitialWorkItem(tenant.firmId(), request.clientId(), template.workflowId(),
                workItemTitle, workItemDescription(template, periodStart, periodEnd), dueDate, clock.instant());
        Engagement created = engagements.save(new Engagement(UUID.randomUUID(), tenant.firmId(), template.id(), request.clientId(),
                template.workflowId(), workItemId, periodStart, periodEnd, dueDate, clock.instant()));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "work-item.created", "work-item", workItemId,
                Map.of("title", workItemTitle, "workflowId", template.workflowId().toString(), "source", "engagement"));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement.created", "engagement", created.id(),
                Map.of("templateName", template.name(), "periodStart", periodStart.toString(),
                        "dueDate", dueDate.toString(), "workItemId", workItemId.toString()));
        return engagementView(created);
    }

    private LocalDate normalizedPeriodStart(LocalDate date, Recurrence recurrence) {
        return switch (recurrence) {
            case MONTHLY -> date.withDayOfMonth(1);
            case QUARTERLY -> date.withMonth(((date.getMonthValue() - 1) / 3) * 3 + 1).withDayOfMonth(1);
            case ANNUAL -> date.withDayOfYear(1);
        };
    }
    private LocalDate periodEnd(LocalDate start, Recurrence recurrence) {
        return switch (recurrence) {
            case MONTHLY -> start.plusMonths(1).minusDays(1);
            case QUARTERLY -> start.plusMonths(3).minusDays(1);
            case ANNUAL -> start.plusYears(1).minusDays(1);
        };
    }
    private EngagementTemplateView templateView(EngagementTemplate template) {
        return new EngagementTemplateView(template.id(), template.name(), template.workflowId(), template.recurrence(),
                template.defaultWorkItemTitle(), template.dueDay(), template.version());
    }
    private EngagementView engagementView(Engagement engagement) {
        return new EngagementView(engagement.id(), engagement.templateId(), engagement.clientId(), engagement.workflowId(), engagement.workItemId(),
                engagement.periodStart(), engagement.periodEnd(), engagement.dueDate(), engagement.status(), engagement.version());
    }
    private String workItemTitle(EngagementTemplate template, LocalDate periodStart) {
        return template.defaultWorkItemTitle().replace("{{period}}", periodLabel(periodStart, template.recurrence())).strip();
    }
    private String periodLabel(LocalDate periodStart, Recurrence recurrence) {
        return switch (recurrence) {
            case MONTHLY -> periodStart.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH)
                    + " " + periodStart.getYear();
            case QUARTERLY -> "Q" + (((periodStart.getMonthValue() - 1) / 3) + 1) + " " + periodStart.getYear();
            case ANNUAL -> String.valueOf(periodStart.getYear());
        };
    }
    private String workItemDescription(EngagementTemplate template, LocalDate periodStart, LocalDate periodEnd) {
        return "Generated from " + template.name() + " for " + PERIOD_FORMAT.format(periodStart)
                + " to " + PERIOD_FORMAT.format(periodEnd) + ".";
    }
    private void requireWrite(SelectedTenant tenant) {
        if (!tenant.canWrite()) throw new AccessDeniedException("Read-only members cannot change engagements");
    }
}
