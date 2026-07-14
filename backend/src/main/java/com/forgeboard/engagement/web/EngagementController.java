package com.forgeboard.engagement.web;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.forgeboard.engagement.application.CreateEngagementRequest;
import com.forgeboard.engagement.application.EngagementService;
import com.forgeboard.engagement.application.EngagementTemplateRequest;
import com.forgeboard.engagement.application.EngagementTemplateView;
import com.forgeboard.engagement.application.EngagementView;
import com.forgeboard.identity.SelectedTenant;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/engagements")
public class EngagementController {
    private final EngagementService engagements;
    public EngagementController(EngagementService engagements) { this.engagements = engagements; }

    @GetMapping
    List<EngagementView> list(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant) {
        return engagements.listEngagements(tenant);
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

    @PostMapping("/templates/{templateId}/instances")
    ResponseEntity<EngagementView> createEngagement(
            @RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID templateId, @Valid @RequestBody CreateEngagementRequest request) {
        EngagementView created = engagements.createEngagement(tenant, templateId, request);
        return ResponseEntity.created(URI.create("/api/engagements/" + created.id())).body(created);
    }
}
