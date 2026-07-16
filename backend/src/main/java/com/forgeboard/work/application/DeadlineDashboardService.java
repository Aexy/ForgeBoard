package com.forgeboard.work.application;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.work.domain.StageAttention;
import com.forgeboard.work.domain.WorkItem;
import com.forgeboard.work.persistence.WorkItemRepository;
import com.forgeboard.work.persistence.WorkflowStageRepository;

@Service
public class DeadlineDashboardService {
    private final WorkItemRepository items; private final WorkflowStageRepository stages; private final Clock clock;
    public DeadlineDashboardService(WorkItemRepository items, WorkflowStageRepository stages, Clock clock) { this.items = items; this.stages = stages; this.clock = clock; }

    @Transactional(readOnly = true)
    public DeadlineDashboardView overview(SelectedTenant tenant) {
        LocalDate today = LocalDate.now(clock); LocalDate dueSoon = today.plusDays(7);
        var workflowStages = stages.findAllByFirmIdOrderByWorkflowIdAscPositionAsc(tenant.firmId());
        Map<UUID, String> stageNames = workflowStages.stream()
                .collect(java.util.stream.Collectors.toMap(stage -> stage.id(), stage -> stage.name()));
        Map<UUID, StageAttention> stageAttention = workflowStages.stream()
                .collect(java.util.stream.Collectors.toMap(stage -> stage.id(), stage -> stage.attention()));
        List<DeadlineWorkItemView> attention = items.findAllByFirmIdOrderByDueDateAsc(tenant.firmId()).stream()
                .map(item -> attention(item, stageNames.getOrDefault(item.stageId(), "Workflow stage"),
                        stageAttention.getOrDefault(item.stageId(), StageAttention.NONE), today, dueSoon))
                .filter(java.util.Objects::nonNull).toList();
        return new DeadlineDashboardView(today,
                attention.stream().filter(item -> item.attention().equals("OVERDUE")).count(),
                attention.stream().filter(item -> item.attention().equals("DUE_SOON")).count(),
                attention.stream().filter(item -> item.attention().equals("BLOCKED")).count(),
                attention.stream().filter(item -> item.attention().equals("AWAITING_REVIEW")).count(), attention);
    }
    private DeadlineWorkItemView attention(WorkItem item, String stageName, StageAttention stageAttention, LocalDate today, LocalDate dueSoon) {
        String status = item.dueDate() != null && item.dueDate().isBefore(today) ? "OVERDUE"
                : stageAttention == StageAttention.BLOCKED ? "BLOCKED"
                : stageAttention == StageAttention.AWAITING_REVIEW ? "AWAITING_REVIEW"
                : item.dueDate() != null && !item.dueDate().isAfter(dueSoon) ? "DUE_SOON" : null;
        return status == null ? null : new DeadlineWorkItemView(item.id(), item.title(), item.workflowId(), item.stageId(), stageName, item.dueDate(), status);
    }
}
