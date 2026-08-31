package com.forgeboard.engagement.application;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.forgeboard.engagement.domain.Engagement;
import com.forgeboard.engagement.domain.EngagementChecklistItem;
import com.forgeboard.engagement.domain.Recurrence;
import com.forgeboard.engagement.persistence.EngagementChecklistItemRepository;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateVersionChecklistItemRepository;
import com.forgeboard.work.WorkflowDirectory;

/** Shared transactional creation path for manual and scheduled engagement instances. */
@Service
public class EngagementMaterializer {
    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private final EngagementRepository engagements;
    private final EngagementTemplateVersionChecklistItemRepository templateChecklistItems;
    private final EngagementChecklistItemRepository checklistItems;
    private final WorkflowDirectory workflows;

    public EngagementMaterializer(EngagementRepository engagements,
            EngagementTemplateVersionChecklistItemRepository templateChecklistItems,
            EngagementChecklistItemRepository checklistItems, WorkflowDirectory workflows) {
        this.engagements = engagements; this.templateChecklistItems = templateChecklistItems;
        this.checklistItems = checklistItems; this.workflows = workflows;
    }

    /** Returns the existing-or-created result without allocating a work item for an existing period. */
    public MaterializedEngagement materialize(UUID firmId, UUID clientId, EngagementDefinition definition,
            LocalDate requestedPeriodStart, LocalDate dueDate, Instant now) {
        LocalDate periodStart = normalizedPeriodStart(requestedPeriodStart, definition.recurrence());
        if (engagements.existsByFirmIdAndTemplateIdAndClientIdAndPeriodStart(firmId, definition.templateId(), clientId, periodStart))
            return MaterializedEngagement.alreadyExists(periodStart);
        LocalDate periodEnd = periodEnd(periodStart, definition.recurrence());
        String title = title(definition, periodStart);
        UUID workItemId = workflows.createInitialWorkItem(firmId, clientId, definition.workflowId(), title,
                description(definition, periodStart, periodEnd), dueDate, now);
        Engagement created = engagements.save(new Engagement(UUID.randomUUID(), firmId, definition.templateId(), definition.version(),
                clientId, definition.workflowId(), workItemId, periodStart, periodEnd, dueDate, now));
        List<EngagementChecklistItem> snapshots = templateChecklistItems
                .findAllByFirmIdAndTemplateIdAndDefinitionVersionOrderByPositionAsc(firmId, definition.templateId(), definition.version())
                .stream().map(item -> new EngagementChecklistItem(UUID.randomUUID(), firmId, created.id(), item.id(),
                        item.label(), item.required(), item.position())).toList();
        if (!snapshots.isEmpty()) checklistItems.saveAll(snapshots);
        return MaterializedEngagement.created(created, title);
    }

    public LocalDate normalizedPeriodStart(LocalDate date, Recurrence recurrence) {
        return switch (recurrence) {
            case MONTHLY -> date.withDayOfMonth(1);
            case QUARTERLY -> date.withMonth(((date.getMonthValue() - 1) / 3) * 3 + 1).withDayOfMonth(1);
            case ANNUAL -> date.withDayOfYear(1);
        };
    }
    public LocalDate periodEnd(LocalDate start, Recurrence recurrence) {
        return switch (recurrence) {
            case MONTHLY -> start.plusMonths(1).minusDays(1);
            case QUARTERLY -> start.plusMonths(3).minusDays(1);
            case ANNUAL -> start.plusYears(1).minusDays(1);
        };
    }
    private String title(EngagementDefinition definition, LocalDate periodStart) {
        return definition.defaultWorkItemTitle().replace("{{period}}", periodLabel(periodStart, definition.recurrence())).strip();
    }
    private String periodLabel(LocalDate periodStart, Recurrence recurrence) {
        return switch (recurrence) {
            case MONTHLY -> periodStart.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + periodStart.getYear();
            case QUARTERLY -> "Q" + (((periodStart.getMonthValue() - 1) / 3) + 1) + " " + periodStart.getYear();
            case ANNUAL -> String.valueOf(periodStart.getYear());
        };
    }
    private String description(EngagementDefinition definition, LocalDate start, LocalDate end) {
        return "Generated from " + definition.templateName() + " for " + PERIOD_FORMAT.format(start) + " to " + PERIOD_FORMAT.format(end) + ".";
    }

    public record MaterializedEngagement(Engagement engagement, String workItemTitle, LocalDate periodStart, boolean created) {
        static MaterializedEngagement created(Engagement engagement, String title) {
            return new MaterializedEngagement(engagement, title, engagement.periodStart(), true);
        }
        static MaterializedEngagement alreadyExists(LocalDate periodStart) {
            return new MaterializedEngagement(null, null, periodStart, false);
        }
    }
}
