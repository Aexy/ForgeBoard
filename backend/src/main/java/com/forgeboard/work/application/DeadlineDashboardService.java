package com.forgeboard.work.application;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.identity.SelectedTenant;
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
        Map<UUID, String> stageNames = stages.findAllByFirmIdOrderByWorkflowIdAscPositionAsc(tenant.firmId()).stream().collect(java.util.stream.Collectors.toMap(stage -> stage.id(), stage -> stage.name()));
        List<DeadlineWorkItemView> attention = items.findAllByFirmIdOrderByDueDateAsc(tenant.firmId()).stream()
                .map(item -> attention(item, stageNames.getOrDefault(item.stageId(), "Workflow stage"), today, dueSoon))
                .filter(java.util.Objects::nonNull).toList();
        return new DeadlineDashboardView(today,
                attention.stream().filter(item -> item.attention().equals("OVERDUE")).count(),
                attention.stream().filter(item -> item.attention().equals("DUE_SOON")).count(),
                attention.stream().filter(item -> item.attention().equals("BLOCKED")).count(),
                attention.stream().filter(item -> item.attention().equals("AWAITING_REVIEW")).count(), attention);
    }
    private DeadlineWorkItemView attention(WorkItem item, String stageName, LocalDate today, LocalDate dueSoon) {
        String normalized = stageName.toLowerCase(); String status = item.dueDate() != null && item.dueDate().isBefore(today) ? "OVERDUE"
                : normalized.contains("block") ? "BLOCKED" : normalized.contains("review") ? "AWAITING_REVIEW"
                : item.dueDate() != null && !item.dueDate().isAfter(dueSoon) ? "DUE_SOON" : null;
        return status == null ? null : new DeadlineWorkItemView(item.id(), item.title(), item.workflowId(), item.stageId(), stageName, item.dueDate(), status);
    }
}
