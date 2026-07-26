package com.forgeboard.engagement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import com.forgeboard.engagement.domain.Engagement;
import com.forgeboard.engagement.domain.EngagementReviewDecision;
import com.forgeboard.engagement.domain.EngagementReviewDecisionType;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.engagement.persistence.EngagementReviewDecisionRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.work.WorkItemAssignmentDirectory;
import com.forgeboard.work.WorkItemAssignmentRoles;
import com.forgeboard.work.domain.StageAttention;
import com.forgeboard.work.domain.WorkItem;
import com.forgeboard.work.domain.WorkPriority;
import com.forgeboard.work.domain.WorkflowStage;

class EngagementLifecycleServiceTest {
    private static final Instant NOW = Instant.parse("2026-07-24T10:00:00Z");
    private EngagementRepository engagements;
    private EngagementReviewDecisionRepository decisions;
    private WorkItemAssignmentDirectory assignments;
    private ActivityRecorder activity;
    private SelectedTenant tenant;
    private UUID owner;
    private UUID reviewer;
    private WorkItem item;
    private Engagement engagement;
    private EngagementLifecycleService service;

    @BeforeEach
    void setUp() {
        engagements = org.mockito.Mockito.mock(EngagementRepository.class);
        decisions = org.mockito.Mockito.mock(EngagementReviewDecisionRepository.class);
        assignments = org.mockito.Mockito.mock(WorkItemAssignmentDirectory.class);
        activity = org.mockito.Mockito.mock(ActivityRecorder.class);
        owner = UUID.randomUUID(); reviewer = UUID.randomUUID();
        tenant = new SelectedTenant(UUID.randomUUID(), owner, "owner@example.com", MembershipRole.MEMBER);
        UUID workflowId = UUID.randomUUID(); UUID sourceId = UUID.randomUUID();
        item = new WorkItem(UUID.randomUUID(), tenant.firmId(), UUID.randomUUID(), workflowId, sourceId, "June", "", null,
                WorkPriority.NORMAL, BigDecimal.ONE, "FB-1", NOW);
        engagement = new Engagement(UUID.randomUUID(), tenant.firmId(), UUID.randomUUID(), UUID.randomUUID(), workflowId,
                item.id(), LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31), LocalDate.of(2026, 8, 20), NOW);
        service = new EngagementLifecycleService(engagements, decisions, assignments, activity, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void ownerSubmitsAndReviewerApprovesOnlyFromAwaitingReview() {
        WorkflowStage preparation = stage(item.stageId(), 0, StageAttention.NONE, false);
        WorkflowStage review = stage(UUID.randomUUID(), 1, StageAttention.AWAITING_REVIEW, false);
        WorkflowStage complete = stage(UUID.randomUUID(), 2, StageAttention.NONE, true);
        linked();
        when(assignments.roles(tenant.firmId(), item.id())).thenReturn(new WorkItemAssignmentRoles(owner, reviewer));

        assertThat(service.onWorkItemMove(move(preparation, review, List.of(preparation, review, complete), owner, null)))
                .isEqualTo(review.id());
        assertThat(service.onWorkItemMove(move(review, complete, List.of(preparation, review, complete), reviewer, null)))
                .isEqualTo(complete.id());

        assertThat(engagement.status().name()).isEqualTo("COMPLETE");
        verify(decisions).save(any(EngagementReviewDecision.class));
    }

    @Test
    void reviewReturnRequiresNoteAndPersistsItWithoutAuditingTheText() {
        WorkflowStage preparation = stage(UUID.randomUUID(), 0, StageAttention.NONE, false);
        WorkflowStage review = stage(item.stageId(), 1, StageAttention.AWAITING_REVIEW, false);
        linked(); engagement.submitForReview(NOW);
        when(assignments.roles(tenant.firmId(), item.id())).thenReturn(new WorkItemAssignmentRoles(owner, reviewer));

        assertThatThrownBy(() -> service.onWorkItemMove(move(review, preparation, List.of(preparation, review), reviewer, " ")))
                .isInstanceOf(com.forgeboard.work.WorkItemLifecycleConflictException.class);
        service.onWorkItemMove(move(review, preparation, List.of(preparation, review), reviewer, " Need evidence "));

        org.mockito.ArgumentCaptor<EngagementReviewDecision> captured = org.mockito.ArgumentCaptor.forClass(EngagementReviewDecision.class);
        verify(decisions).save(captured.capture());
        assertThat(captured.getValue().decision()).isEqualTo(EngagementReviewDecisionType.RETURNED);
        assertThat(captured.getValue().note()).isEqualTo("Need evidence");
        verify(activity).recordRestUserAction(tenant.firmId(), reviewer, "engagement.review-returned", "engagement",
                engagement.id(), java.util.Map.of("workItemId", item.id().toString()));
    }

    @Test
    void rejectsWrongRolesTerminalMovesAndDirectFinalMoves() {
        WorkflowStage preparation = stage(item.stageId(), 0, StageAttention.NONE, false);
        WorkflowStage review = stage(UUID.randomUUID(), 1, StageAttention.AWAITING_REVIEW, false);
        WorkflowStage complete = stage(UUID.randomUUID(), 2, StageAttention.NONE, true);
        linked();
        when(assignments.roles(tenant.firmId(), item.id())).thenReturn(new WorkItemAssignmentRoles(owner, reviewer));

        assertThatThrownBy(() -> service.onWorkItemMove(move(preparation, review, List.of(preparation, review, complete), reviewer, null)))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.onWorkItemMove(move(preparation, complete, List.of(preparation, review, complete), owner, null)))
                .isInstanceOf(com.forgeboard.work.WorkItemLifecycleConflictException.class);
        service.onWorkItemMove(move(preparation, review, List.of(preparation, review, complete), owner, null));
        assertThatThrownBy(() -> service.onWorkItemMove(move(review, preparation, List.of(preparation, review, complete), owner, "Needs work")))
                .isInstanceOf(AccessDeniedException.class);
        engagement.returnForPreparation(NOW);
        engagement.cancel(NOW);
        assertThatThrownBy(() -> service.onWorkItemMove(move(preparation, review, List.of(preparation, review, complete), owner, null)))
                .isInstanceOf(com.forgeboard.work.WorkItemLifecycleConflictException.class);
    }

    @Test
    void blocksAndResumesWithSafeLifecycleAudits() {
        WorkflowStage preparation = stage(item.stageId(), 0, StageAttention.NONE, false);
        WorkflowStage blocked = stage(UUID.randomUUID(), 1, StageAttention.BLOCKED, false);
        linked();

        service.onWorkItemMove(move(preparation, blocked, List.of(preparation, blocked), owner, null));
        service.onWorkItemMove(move(blocked, preparation, List.of(preparation, blocked), owner, null));

        verify(activity).recordRestUserAction(tenant.firmId(), owner, "engagement.blocked", "engagement",
                engagement.id(), java.util.Map.of("workItemId", item.id().toString()));
        verify(activity).recordRestUserAction(tenant.firmId(), owner, "engagement.resumed", "engagement",
                engagement.id(), java.util.Map.of("workItemId", item.id().toString()));
    }

    @Test
    void treatsAnEngagementOutsideTheSelectedFirmAsAnUnlinkedCard() {
        WorkflowStage preparation = stage(item.stageId(), 0, StageAttention.NONE, false);
        WorkflowStage blocked = stage(UUID.randomUUID(), 1, StageAttention.BLOCKED, false);
        when(engagements.findByWorkItemIdAndFirmId(item.id(), tenant.firmId())).thenReturn(Optional.empty());

        assertThat(service.onWorkItemMove(move(preparation, blocked, List.of(preparation, blocked), owner, null)))
                .isEqualTo(blocked.id());
        verifyNoInteractions(assignments, decisions, activity);
    }

    private void linked() { when(engagements.findByWorkItemIdAndFirmId(item.id(), tenant.firmId())).thenReturn(Optional.of(engagement)); }
    private WorkflowStage stage(UUID id, int position, StageAttention attention, boolean finalStage) {
        return new WorkflowStage(id, tenant.firmId(), item.workflowId(), "Stage", attention, position, finalStage, NOW);
    }
    private com.forgeboard.work.WorkItemLifecycleMove move(WorkflowStage source, WorkflowStage target, List<WorkflowStage> stages,
            UUID actor, String note) {
        UUID previous = stages.stream().filter(stage -> stage.position() == source.position() - 1).map(WorkflowStage::id)
                .findFirst().orElse(null);
        return new com.forgeboard.work.WorkItemLifecycleMove(tenant.firmId(), item.id(), actor, target.id(), previous,
                target.finalStage(), target.attention() == StageAttention.AWAITING_REVIEW,
                source.attention() == StageAttention.BLOCKED, target.attention() == StageAttention.BLOCKED, note);
    }
}
