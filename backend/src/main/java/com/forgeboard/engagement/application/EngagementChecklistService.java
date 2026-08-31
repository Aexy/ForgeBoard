package com.forgeboard.engagement.application;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.engagement.domain.EngagementChecklistItem;
import com.forgeboard.engagement.persistence.EngagementChecklistItemRepository;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.WorkItemAssignmentDirectory;

@Service
public class EngagementChecklistService {
    private final EngagementRepository engagements;
    private final EngagementChecklistItemRepository checklistItems;
    private final WorkItemAssignmentDirectory assignments;
    private final ActivityRecorder activity;
    private final Clock clock;

    public EngagementChecklistService(EngagementRepository engagements, EngagementChecklistItemRepository checklistItems,
            WorkItemAssignmentDirectory assignments, ActivityRecorder activity, Clock clock) {
        this.engagements = engagements; this.checklistItems = checklistItems; this.assignments = assignments;
        this.activity = activity; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<EngagementChecklistItemView> list(SelectedTenant tenant, UUID engagementId) {
        var engagement = requireEngagement(tenant, engagementId);
        boolean canUpdate = tenant.userId().equals(assignments.roles(tenant.firmId(), engagement.workItemId()).ownerUserId());
        return checklistItems.findAllByFirmIdAndEngagementIdOrderByPositionAsc(tenant.firmId(), engagementId).stream()
                .map(item -> view(item, canUpdate)).toList();
    }

    @Transactional
    public EngagementChecklistItemView update(SelectedTenant tenant, UUID engagementId, UUID itemId,
            UpdateEngagementChecklistItemRequest request) {
        var engagement = requireEngagement(tenant, engagementId);
        if (!tenant.userId().equals(assignments.roles(tenant.firmId(), engagement.workItemId()).ownerUserId()))
            throw new AccessDeniedException("Only the assigned preparer may update this engagement checklist");
        EngagementChecklistItem item = checklistItems.findByIdAndFirmIdAndEngagementId(itemId, tenant.firmId(), engagementId)
                .orElseThrow(() -> new EngagementNotFoundException("Checklist item was not found in the selected engagement"));
        if (item.version() != request.expectedVersion())
            throw new EngagementAlreadyExistsException("The checklist item was changed by another user");
        if (item.completed() != request.completed()) {
            item.setCompleted(request.completed(), tenant.userId(), clock.instant());
            checklistItems.save(item);
            activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "engagement.checklist-item-updated", "engagement",
                    engagementId, Map.of("checklistItemId", item.id().toString(), "completed", request.completed()));
        }
        return view(item, true);
    }

    private com.forgeboard.engagement.domain.Engagement requireEngagement(SelectedTenant tenant, UUID engagementId) {
        return engagements.findByIdAndFirmId(engagementId, tenant.firmId())
                .orElseThrow(() -> new EngagementNotFoundException("Engagement was not found in the selected firm"));
    }
    private EngagementChecklistItemView view(EngagementChecklistItem item, boolean canUpdate) {
        return new EngagementChecklistItemView(item.id(), item.label(), item.required(), item.position(),
                item.completedBy(), item.completedAt(), item.version(), canUpdate);
    }
}
