package com.forgeboard.engagement.web;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.forgeboard.engagement.application.CreateEngagementRequest;
import com.forgeboard.engagement.application.EngagementService;
import com.forgeboard.engagement.application.EngagementTemplateRequest;
import com.forgeboard.engagement.application.EngagementTemplateView;
import com.forgeboard.engagement.application.EngagementView;
import com.forgeboard.engagement.application.UpdateEngagementTemplateRequest;
import com.forgeboard.engagement.application.TemplateEnrollmentRequest;
import com.forgeboard.engagement.application.TemplateEnrollmentView;
import com.forgeboard.engagement.application.EngagementChecklistService;
import com.forgeboard.engagement.application.EngagementChecklistItemView;
import com.forgeboard.engagement.application.UpdateEngagementChecklistItemRequest;
import com.forgeboard.engagement.EngagementDetail;
import com.forgeboard.engagement.application.ExpectedVersionRequest;
import com.forgeboard.engagement.application.RecurrenceFailureService;
import com.forgeboard.engagement.application.RecurrenceFailureView;
import com.forgeboard.identity.SelectedTenant;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/engagements")
public class EngagementController {
    private final EngagementService engagements;
    private final EngagementChecklistService checklist;
    private final RecurrenceFailureService recurrenceFailures;
    public EngagementController(EngagementService engagements, EngagementChecklistService checklist, RecurrenceFailureService recurrenceFailures) {
        this.engagements = engagements; this.checklist = checklist; this.recurrenceFailures = recurrenceFailures;
    }

    @GetMapping
    List<EngagementView> list(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant) {
        return engagements.listEngagements(tenant);
    }

    @GetMapping("/{engagementId}")
    EngagementDetail get(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID engagementId) {
        return engagements.getEngagement(tenant, engagementId);
    }

    @PostMapping("/{engagementId}/cancel")
    EngagementView cancel(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID engagementId, @Valid @RequestBody ExpectedVersionRequest request) {
        return engagements.cancel(tenant, engagementId, request);
    }

    @PostMapping("/{engagementId}/reopen")
    EngagementView reopen(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID engagementId, @Valid @RequestBody ExpectedVersionRequest request) {
        return engagements.reopen(tenant, engagementId, request);
    }

    @PostMapping("/{engagementId}/archive")
    EngagementView archive(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID engagementId, @Valid @RequestBody ExpectedVersionRequest request) {
        return engagements.archive(tenant, engagementId, request);
    }

    @PostMapping("/{engagementId}/unarchive")
    EngagementView unarchive(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID engagementId, @Valid @RequestBody ExpectedVersionRequest request) {
        return engagements.unarchive(tenant, engagementId, request);
    }

    @GetMapping("/templates")
    List<EngagementTemplateView> listTemplates(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant) {
        return engagements.listTemplates(tenant);
    }

    @PostMapping("/templates")
    ResponseEntity<EngagementTemplateView> createTemplate(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @Valid @RequestBody EngagementTemplateRequest request) {
        EngagementTemplateView created = engagements.createTemplate(tenant, request);
        return ResponseEntity.created(URI.create("/api/engagements/templates/" + created.id())).body(created);
    }

    @GetMapping("/recurrence-failures")
    List<RecurrenceFailureView> listRecurrenceFailures(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant) {
        return recurrenceFailures.list(tenant);
    }

    @PostMapping("/recurrence-failures/{runId}/retry")
    RecurrenceFailureView retryRecurrenceFailure(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID runId) { return recurrenceFailures.retry(tenant, runId); }

    @PostMapping("/recurrence-failures/{runId}/mark-solved")
    ResponseEntity<Void> markRecurrenceFailureSolved(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID runId) { recurrenceFailures.markSolved(tenant, runId); return ResponseEntity.noContent().build(); }

    @PostMapping("/recurrence-failures/{runId}/generate")
    RecurrenceFailureView generateRecurrenceFailure(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID runId) { return recurrenceFailures.generateNow(tenant, runId); }

    @GetMapping("/{engagementId}/checklist")
    List<EngagementChecklistItemView> listChecklist(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID engagementId) {
        return checklist.list(tenant, engagementId);
    }

    @PatchMapping("/{engagementId}/checklist/{itemId}")
    EngagementChecklistItemView updateChecklist(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID engagementId, @PathVariable UUID itemId,
            @Valid @RequestBody UpdateEngagementChecklistItemRequest request) {
        return checklist.update(tenant, engagementId, itemId, request);
    }

    @PutMapping("/templates/{templateId}")
    EngagementTemplateView updateTemplate(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID templateId, @Valid @RequestBody UpdateEngagementTemplateRequest request) {
        return engagements.updateTemplate(tenant, templateId, request);
    }

    @GetMapping("/templates/{templateId}/enrollments")
    List<com.forgeboard.engagement.application.TemplateEnrollmentClientView> listEnrollments(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID templateId) {
        return engagements.listEnrolledClients(tenant, templateId);
    }

    @PostMapping("/templates/{templateId}/enrollments")
    TemplateEnrollmentView enrollClients(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID templateId, @Valid @RequestBody TemplateEnrollmentRequest request) {
        return engagements.enrollClients(tenant, templateId, request);
    }

    @DeleteMapping("/templates/{templateId}/enrollments")
    TemplateEnrollmentView unenrollClients(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID templateId, @Valid @RequestBody TemplateEnrollmentRequest request) {
        return engagements.unenrollClients(tenant, templateId, request);
    }

    @PostMapping("/templates/{templateId}/instances")
    ResponseEntity<EngagementView> createEngagement(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID templateId, @Valid @RequestBody CreateEngagementRequest request) {
        EngagementView created = engagements.createEngagement(tenant, templateId, request);
        return ResponseEntity.created(URI.create("/api/engagements/" + created.id())).body(created);
    }
}
