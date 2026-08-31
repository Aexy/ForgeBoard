package com.forgeboard.engagement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.access.AccessDeniedException;
import com.forgeboard.engagement.domain.Engagement;
import com.forgeboard.engagement.domain.EngagementChecklistItem;
import com.forgeboard.engagement.persistence.EngagementChecklistItemRepository;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.work.WorkItemAssignmentDirectory;
import com.forgeboard.work.WorkItemAssignmentRoles;

class EngagementChecklistServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-31T08:00:00Z");
    private final UUID firmId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID engagementId = UUID.randomUUID();
    private final UUID workItemId = UUID.randomUUID();
    private EngagementRepository engagements;
    private EngagementChecklistItemRepository items;
    private WorkItemAssignmentDirectory assignments;
    private ActivityRecorder activity;
    private SelectedTenant tenant;
    private EngagementChecklistService service;

    @BeforeEach
    void setup() {
        engagements = Mockito.mock(EngagementRepository.class); items = Mockito.mock(EngagementChecklistItemRepository.class);
        assignments = Mockito.mock(WorkItemAssignmentDirectory.class); activity = Mockito.mock(ActivityRecorder.class);
        tenant = new SelectedTenant(firmId, userId, "preparer@example.com", MembershipRole.MEMBER);
        service = new EngagementChecklistService(engagements, items, assignments, activity, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void assignedPreparerCompletesItemAndRecordsSafeAudit() {
        Engagement engagement = engagement();
        EngagementChecklistItem item = new EngagementChecklistItem(UUID.randomUUID(), firmId, engagementId, UUID.randomUUID(),
                "Reconcile bank", true, 0);
        when(engagements.findByIdAndFirmId(engagementId, firmId)).thenReturn(Optional.of(engagement));
        when(assignments.roles(firmId, workItemId)).thenReturn(new WorkItemAssignmentRoles(userId, UUID.randomUUID()));
        when(items.findByIdAndFirmIdAndEngagementId(item.id(), firmId, engagementId)).thenReturn(Optional.of(item));

        EngagementChecklistItemView result = service.update(tenant, engagementId, item.id(),
                new UpdateEngagementChecklistItemRequest(true, 0));

        assertThat(result.isCompleted()).isTrue();
        assertThat(result.completedBy()).isEqualTo(userId);
        verify(items).save(item);
        verify(activity).recordRestUserAction(firmId, userId, "engagement.checklist-item-updated", "engagement", engagementId,
                java.util.Map.of("checklistItemId", item.id().toString(), "completed", true));
    }

    @Test
    void rejectsUsersWhoAreNotTheAssignedPreparer() {
        when(engagements.findByIdAndFirmId(engagementId, firmId)).thenReturn(Optional.of(engagement()));
        when(assignments.roles(firmId, workItemId)).thenReturn(new WorkItemAssignmentRoles(UUID.randomUUID(), UUID.randomUUID()));

        assertThatThrownBy(() -> service.update(tenant, engagementId, UUID.randomUUID(),
                new UpdateEngagementChecklistItemRequest(true, 0))).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void projectsUpdateCapabilityFromTheAssignedPreparer() {
        EngagementChecklistItem item = new EngagementChecklistItem(UUID.randomUUID(), firmId, engagementId, UUID.randomUUID(),
                "Reconcile bank", true, 0);
        when(engagements.findByIdAndFirmId(engagementId, firmId)).thenReturn(Optional.of(engagement()));
        when(assignments.roles(firmId, workItemId)).thenReturn(new WorkItemAssignmentRoles(userId, UUID.randomUUID()));
        when(items.findAllByFirmIdAndEngagementIdOrderByPositionAsc(firmId, engagementId)).thenReturn(List.of(item));

        assertThat(service.list(tenant, engagementId)).allSatisfy(view -> assertThat(view.canUpdate()).isTrue());

        when(assignments.roles(firmId, workItemId)).thenReturn(new WorkItemAssignmentRoles(UUID.randomUUID(), UUID.randomUUID()));
        assertThat(service.list(tenant, engagementId)).allSatisfy(view -> assertThat(view.canUpdate()).isFalse());
    }

    @Test
    void rejectsChecklistItemsOutsideTheSelectedEngagement() {
        when(engagements.findByIdAndFirmId(engagementId, firmId)).thenReturn(Optional.of(engagement()));
        when(assignments.roles(firmId, workItemId)).thenReturn(new WorkItemAssignmentRoles(userId, UUID.randomUUID()));
        when(items.findByIdAndFirmIdAndEngagementId(any(), any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(tenant, engagementId, UUID.randomUUID(),
                new UpdateEngagementChecklistItemRequest(true, 0))).isInstanceOf(EngagementNotFoundException.class);
    }

    private Engagement engagement() {
        return new Engagement(engagementId, firmId, UUID.randomUUID(), 1, UUID.randomUUID(), UUID.randomUUID(), workItemId,
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), LocalDate.of(2026, 9, 20), NOW);
    }
}
