package com.forgeboard.engagement.application;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.YearMonth;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Collection;
import java.util.Set;
import java.util.HashMap;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.client.ClientDirectory;
import com.forgeboard.engagement.EngagementDetail;
import com.forgeboard.engagement.EngagementLifecycleHistory;
import com.forgeboard.engagement.EngagementReviewDecision;
import com.forgeboard.engagement.EngagementSummary;
import com.forgeboard.work.WorkItemEngagementDetail;
import com.forgeboard.work.WorkItemEngagementDetails;
import com.forgeboard.engagement.domain.Engagement;
import com.forgeboard.engagement.domain.EngagementTemplate;
import com.forgeboard.engagement.domain.EngagementTemplateEnrollment;
import com.forgeboard.engagement.domain.EngagementTemplateVersion;
import com.forgeboard.engagement.domain.Recurrence;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.engagement.persistence.EngagementReviewDecisionRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateEnrollmentRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateVersionRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.WorkflowDirectory;

@Service
public class EngagementService implements WorkItemEngagementDetails {
    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private final EngagementTemplateRepository templates;
    private final EngagementTemplateVersionRepository templateVersions;
    private final EngagementTemplateEnrollmentRepository enrollments;
    private final EngagementRepository engagements;
    private final EngagementReviewDecisionRepository reviewDecisions;
    private final WorkflowDirectory workflows;
    private final ClientDirectory clients;
    private final ActivityRecorder activity;
    private final Clock clock;

    public EngagementService(EngagementTemplateRepository templates, EngagementTemplateVersionRepository templateVersions,
            EngagementTemplateEnrollmentRepository enrollments, EngagementRepository engagements,
            EngagementReviewDecisionRepository reviewDecisions, WorkflowDirectory workflows, ClientDirectory clients,
            ActivityRecorder activity, Clock clock) {
        this.templates = templates; this.templateVersions = templateVersions; this.enrollments = enrollments;
        this.engagements = engagements; this.workflows = workflows; this.reviewDecisions = reviewDecisions;
        this.clients = clients; this.activity = activity; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<EngagementTemplateView> listTemplates(SelectedTenant tenant) {
        List<EngagementTemplate> definitions = templates.findAllByFirmIdOrderByNameAsc(tenant.firmId());
        if (definitions.isEmpty()) return List.of();
        List<UUID> templateIds = definitions.stream().map(EngagementTemplate::id).toList();
        List<EngagementTemplateEnrollment> allEnrollments = enrollments
                .findAllByFirmIdAndTemplateIdIn(tenant.firmId(), templateIds);
        Set<UUID> activeClientIds = clients.findActiveByIds(tenant.firmId(), allEnrollments.stream()
                .map(EngagementTemplateEnrollment::clientId).toList()).stream().map(ClientDirectory.ActiveClient::id)
                .collect(java.util.stream.Collectors.toSet());
        Map<UUID, Long> counts = new HashMap<>();
        allEnrollments.stream().filter(enrollment -> activeClientIds.contains(enrollment.clientId()))
                .forEach(enrollment -> counts.merge(enrollment.templateId(), 1L, Long::sum));
        return definitions.stream().map(template -> templateView(template, counts.getOrDefault(template.id(), 0L))).toList();
    }

    @Transactional
    public EngagementTemplateView createTemplate(SelectedTenant tenant, EngagementTemplateRequest request) {
        requireTemplateManagement(tenant);
        if (!workflows.exists(tenant.firmId(), request.workflowId()))
            throw new EngagementNotFoundException("Workflow was not found in the selected firm");
        String name = request.name().strip();
        if (templates.existsByFirmIdAndName(tenant.firmId(), name)) {
            throw new EngagementAlreadyExistsException("An engagement template with this name already exists");
        }
        EngagementTemplate created = templates.save(new EngagementTemplate(UUID.randomUUID(), tenant.firmId(),
                request.workflowId(), name, request.recurrence(), request.defaultWorkItemTitle().strip(),
                request.dueDay(), clock.instant()));
        templateVersions.save(templateVersion(created, tenant.userId(), clock.instant()));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-template.created", "engagement-template",
                created.id(), Map.of("version", created.currentVersion()));
        return templateView(created);
    }

    @Transactional
    public EngagementTemplateView updateTemplate(SelectedTenant tenant, UUID templateId, UpdateEngagementTemplateRequest request) {
        requireTemplateManagement(tenant);
        EngagementTemplate template = requireTemplate(tenant, templateId);
        if (template.version() != request.expectedVersion())
            throw new EngagementAlreadyExistsException("The template was changed by another user");
        if (!workflows.exists(tenant.firmId(), request.workflowId()))
            throw new EngagementNotFoundException("Workflow was not found in the selected firm");
        String name = request.name().strip();
        if (!template.name().equals(name) && templates.existsByFirmIdAndName(tenant.firmId(), name))
            throw new EngagementAlreadyExistsException("An engagement template with this name already exists");
        Instant now = clock.instant();
        template.advanceDefinition(name, request.workflowId(), request.recurrence(), request.defaultWorkItemTitle().strip(),
                request.dueDay(), now);
        templateVersions.save(templateVersion(template, tenant.userId(), now));
        templates.saveAndFlush(template);
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-template.updated", "engagement-template",
                template.id(), Map.of("version", template.currentVersion()));
        return templateView(template);
    }

    @Transactional(readOnly = true)
    public List<TemplateEnrollmentClientView> listEnrolledClients(SelectedTenant tenant, UUID templateId) {
        requireTemplate(tenant, templateId);
        List<UUID> clientIds = enrollments.findAllByFirmIdAndTemplateId(tenant.firmId(), templateId).stream()
                .map(EngagementTemplateEnrollment::clientId).toList();
        if (clientIds.isEmpty()) return List.of();
        return clients.findActiveByIds(tenant.firmId(), clientIds).stream().map(this::enrollmentClientView).toList();
    }

    @Transactional
    public TemplateEnrollmentView enrollClients(SelectedTenant tenant, UUID templateId, TemplateEnrollmentRequest request) {
        requireTemplateManagement(tenant);
        requireTemplateForEnrollment(tenant, templateId);
        List<ClientDirectory.ActiveClient> validated = requireActiveClients(tenant, request.clientIds());
        List<UUID> ids = validated.stream().map(ClientDirectory.ActiveClient::id).toList();
        var alreadyEnrolled = enrollments.findAllByFirmIdAndTemplateIdAndClientIdIn(tenant.firmId(), templateId, ids).stream()
                .map(EngagementTemplateEnrollment::clientId).collect(java.util.stream.Collectors.toSet());
        List<EngagementTemplateEnrollment> added = ids.stream().filter(id -> !alreadyEnrolled.contains(id))
                .map(id -> new EngagementTemplateEnrollment(UUID.randomUUID(), tenant.firmId(), templateId, id,
                        tenant.userId(), clock.instant())).toList();
        if (!added.isEmpty()) enrollments.saveAll(added);
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-template.clients-enrolled",
                "engagement-template", templateId, Map.of("addedCount", added.size()));
        return new TemplateEnrollmentView(activeEnrollmentCount(tenant.firmId(), templateId));
    }

    @Transactional
    public TemplateEnrollmentView unenrollClients(SelectedTenant tenant, UUID templateId, TemplateEnrollmentRequest request) {
        requireTemplateManagement(tenant);
        requireTemplateForEnrollment(tenant, templateId);
        List<ClientDirectory.ActiveClient> validated = requireActiveClients(tenant, request.clientIds());
        List<UUID> ids = validated.stream().map(ClientDirectory.ActiveClient::id).toList();
        List<EngagementTemplateEnrollment> existing = enrollments
                .findAllByFirmIdAndTemplateIdAndClientIdIn(tenant.firmId(), templateId, ids);
        if (!existing.isEmpty()) enrollments.deleteAll(existing);
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement-template.clients-unenrolled",
                "engagement-template", templateId, Map.of("removedCount", existing.size()));
        return new TemplateEnrollmentView(activeEnrollmentCount(tenant.firmId(), templateId));
    }

    @Transactional(readOnly = true)
    public List<EngagementView> listEngagements(SelectedTenant tenant) {
        return engagements.findAllByFirmIdOrderByDueDateAsc(tenant.firmId()).stream().map(this::engagementView).toList();
    }

    @Transactional(readOnly = true)
    public EngagementDetail getEngagement(SelectedTenant tenant, UUID engagementId) {
        Engagement engagement = requireEngagement(tenant, engagementId);
        return detailView(engagement);
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.Optional<WorkItemEngagementDetail> findByWorkItem(UUID firmId, UUID workItemId) {
        return engagements.findByWorkItemIdAndFirmId(workItemId, firmId).map(this::workItemDetail);
    }

    @Transactional
    public EngagementView cancel(SelectedTenant tenant, UUID engagementId, ExpectedVersionRequest request) {
        return changeLifecycle(tenant, engagementId, request, "engagement.cancelled", Engagement::cancel);
    }

    @Transactional
    public EngagementView reopen(SelectedTenant tenant, UUID engagementId, ExpectedVersionRequest request) {
        return changeLifecycle(tenant, engagementId, request, "engagement.reopened", Engagement::reopen);
    }

    @Transactional
    public EngagementView archive(SelectedTenant tenant, UUID engagementId, ExpectedVersionRequest request) {
        return changeLifecycle(tenant, engagementId, request, "engagement.archived", Engagement::archive);
    }

    @Transactional
    public EngagementView unarchive(SelectedTenant tenant, UUID engagementId, ExpectedVersionRequest request) {
        return changeLifecycle(tenant, engagementId, request, "engagement.unarchived", Engagement::unarchive);
    }

    @Transactional
    public EngagementView createEngagement(SelectedTenant tenant, UUID templateId, CreateEngagementRequest request) {
        requireWrite(tenant);
        EngagementTemplate template = requireTemplate(tenant, templateId);
        if (!enrollments.existsByFirmIdAndTemplateIdAndClientId(tenant.firmId(), template.id(), request.clientId()))
            throw new EngagementNotFoundException("Client is not enrolled in this engagement template");
        if (!clients.existsActive(tenant.firmId(), request.clientId()))
            throw new EngagementNotFoundException("Client was not found or is not active in the selected firm");
        LocalDate periodStart = normalizedPeriodStart(request.periodStart(), template.recurrence());
        if (engagements.existsByFirmIdAndTemplateIdAndClientIdAndPeriodStart(
                tenant.firmId(), template.id(), request.clientId(), periodStart)) {
            throw new EngagementAlreadyExistsException("An engagement already exists for this client and period");
        }
        LocalDate periodEnd = periodEnd(periodStart, template.recurrence());
        LocalDate dueDate = YearMonth.from(periodEnd).atDay(Math.min(template.dueDay(), periodEnd.lengthOfMonth()));
        String workItemTitle = workItemTitle(template, periodStart);
        UUID workItemId = workflows.createInitialWorkItem(tenant.firmId(), request.clientId(), template.workflowId(),
                workItemTitle, workItemDescription(template, periodStart, periodEnd), dueDate, clock.instant());
        Engagement created = engagements.save(new Engagement(UUID.randomUUID(), tenant.firmId(), template.id(), template.currentVersion(), request.clientId(),
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
        return templateView(template, activeEnrollmentCount(template.firmId(), template.id()));
    }
    private EngagementTemplateView templateView(EngagementTemplate template, long enrolledClientCount) {
        return new EngagementTemplateView(template.id(), template.name(), template.workflowId(), template.recurrence(),
                template.defaultWorkItemTitle(), template.dueDay(), template.version(), template.currentVersion(),
                enrolledClientCount);
    }
    private EngagementView engagementView(Engagement engagement) {
        return new EngagementView(engagement.id(), engagement.templateId(), engagement.templateVersion(), engagement.clientId(), engagement.workflowId(), engagement.workItemId(),
                engagement.periodStart(), engagement.periodEnd(), engagement.dueDate(), engagement.status(), engagement.statusChangedAt(), engagement.version());
    }
    private EngagementDetail detailView(Engagement engagement) {
        // History is loaded through the scoped repository so a linked work item can never expose another firm's decisions.
        List<EngagementReviewDecision> history = reviewDecisions
                .findAllByFirmIdAndEngagementIdOrderByOccurredAtDescIdDesc(engagement.firmId(), engagement.id()).stream()
                .map(decision -> new EngagementReviewDecision(decision.id(), decision.actorId(), decision.decision().name(),
                        decision.note(), decision.occurredAt())).toList();
        return new EngagementDetail(detailSummary(engagement), new EngagementLifecycleHistory(history));
    }
    private WorkItemEngagementDetail workItemDetail(Engagement engagement) {
        List<WorkItemEngagementDetail.Decision> history = reviewDecisions
                .findAllByFirmIdAndEngagementIdOrderByOccurredAtDescIdDesc(engagement.firmId(), engagement.id()).stream()
                .map(decision -> new WorkItemEngagementDetail.Decision(decision.id(), decision.actorId(),
                        decision.decision().name(), decision.note(), decision.occurredAt())).toList();
        return new WorkItemEngagementDetail(new WorkItemEngagementDetail.Engagement(engagement.id(), engagement.templateId(),
                engagement.clientId(), engagement.workflowId(), engagement.workItemId(), engagement.periodStart(),
                engagement.periodEnd(), engagement.dueDate(), engagement.status().name(), engagement.statusChangedAt(),
                engagement.version()), new WorkItemEngagementDetail.History(history));
    }
    private Engagement requireEngagement(SelectedTenant tenant, UUID engagementId) {
        return engagements.findByIdAndFirmId(engagementId, tenant.firmId())
                .orElseThrow(() -> new EngagementNotFoundException("Engagement was not found in the selected firm"));
    }
    private EngagementTemplate requireTemplate(SelectedTenant tenant, UUID templateId) {
        return templates.findByIdAndFirmId(templateId, tenant.firmId())
                .orElseThrow(() -> new EngagementNotFoundException("Engagement template was not found in the selected firm"));
    }
    private EngagementTemplate requireTemplateForEnrollment(SelectedTenant tenant, UUID templateId) {
        return templates.findByIdAndFirmIdForUpdate(templateId, tenant.firmId())
                .orElseThrow(() -> new EngagementNotFoundException("Engagement template was not found in the selected firm"));
    }
    private EngagementTemplateVersion templateVersion(EngagementTemplate template, UUID actorId, Instant now) {
        return new EngagementTemplateVersion(UUID.randomUUID(), template.firmId(), template.id(), template.currentVersion(),
                template.workflowId(), template.name(), template.recurrence(), template.defaultWorkItemTitle(), template.dueDay(), actorId, now);
    }
    private List<ClientDirectory.ActiveClient> requireActiveClients(SelectedTenant tenant, Collection<UUID> requestedIds) {
        List<UUID> clientIds = List.copyOf(requestedIds);
        if (clientIds.stream().distinct().count() != clientIds.size())
            throw new EngagementAlreadyExistsException("Client IDs must be unique");
        List<ClientDirectory.ActiveClient> found = clients.findActiveByIds(tenant.firmId(), clientIds);
        if (found.size() != clientIds.size())
            throw new EngagementNotFoundException("Client was not found or is not active in the selected firm");
        return found;
    }
    private long activeEnrollmentCount(UUID firmId, UUID templateId) {
        List<UUID> clientIds = enrollments.findAllByFirmIdAndTemplateId(firmId, templateId).stream()
                .map(EngagementTemplateEnrollment::clientId).toList();
        return clients.findActiveByIds(firmId, clientIds).size();
    }
    private TemplateEnrollmentClientView enrollmentClientView(ClientDirectory.ActiveClient client) {
        return new TemplateEnrollmentClientView(client.id(), client.legalName(), client.displayName(),
                client.primaryEmail(), client.version());
    }
    private EngagementView changeLifecycle(SelectedTenant tenant, UUID engagementId, ExpectedVersionRequest request,
            String action, java.util.function.BiConsumer<Engagement, java.time.Instant> transition) {
        requireLifecycleManagement(tenant);
        Engagement engagement = requireEngagement(tenant, engagementId);
        if (engagement.version() != request.expectedVersion())
            throw new EngagementAlreadyExistsException("The engagement was changed by another user");
        transition.accept(engagement, clock.instant());
        engagements.save(engagement);
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), action, "engagement", engagement.id(), Map.of());
        return engagementView(engagement);
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
    private void requireLifecycleManagement(SelectedTenant tenant) {
        if (!tenant.canManageEngagementLifecycle())
            throw new AccessDeniedException("Only owners and managers can manage an engagement lifecycle");
    }
    private void requireTemplateManagement(SelectedTenant tenant) {
        if (!tenant.canManageEngagementTemplates())
            throw new AccessDeniedException("Only owners, administrators, and managers can manage engagement templates");
    }
    private EngagementSummary detailSummary(Engagement engagement) {
        return new EngagementSummary(engagement.id(), engagement.templateId(), engagement.clientId(), engagement.workflowId(),
                engagement.workItemId(), engagement.periodStart(), engagement.periodEnd(), engagement.dueDate(),
                engagement.status().name(), engagement.statusChangedAt(), engagement.version());
    }
}
