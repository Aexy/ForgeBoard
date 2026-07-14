package com.forgeboard.work;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.forgeboard.work.domain.WorkItem;
import com.forgeboard.work.domain.WorkPriority;
import com.forgeboard.work.domain.WorkflowStage;
import com.forgeboard.work.persistence.WorkItemRepository;
import com.forgeboard.work.persistence.WorkflowRepository;
import com.forgeboard.work.persistence.WorkflowStageRepository;

@Service
public class WorkflowDirectory {
    private static final BigDecimal RANK_STEP = new BigDecimal("1000.0000000000");
    private final WorkflowRepository workflows;
    private final WorkflowStageRepository stages;
    private final WorkItemRepository items;
    public WorkflowDirectory(WorkflowRepository workflows, WorkflowStageRepository stages, WorkItemRepository items) {
        this.workflows = workflows; this.stages = stages; this.items = items;
    }
    public boolean exists(UUID firmId, UUID workflowId) { return workflows.existsByIdAndFirmId(workflowId, firmId); }

    public UUID createInitialWorkItem(UUID firmId, UUID clientId, UUID workflowId, String title,
            String description, LocalDate dueDate, Instant now) {
        if (!exists(firmId, workflowId)) throw new IllegalArgumentException("Workflow was not found in the selected firm");
        WorkflowStage firstStage = stages.findAllByFirmIdAndWorkflowIdOrderByPositionAsc(firmId, workflowId).stream()
                .findFirst().orElseThrow(() -> new IllegalStateException("Workflow has no stages"));
        stages.findByIdAndFirmIdAndWorkflowIdForUpdate(firstStage.id(), firmId, workflowId)
                .orElseThrow(() -> new IllegalStateException("Workflow stage was not found"));
        BigDecimal rank = items.maximumRank(firmId, workflowId, firstStage.id()).orElse(BigDecimal.ZERO).add(RANK_STEP);
        WorkItem item = items.save(new WorkItem(UUID.randomUUID(), firmId, clientId, workflowId, firstStage.id(),
                title.strip(), description == null ? "" : description.strip(), dueDate, WorkPriority.NORMAL, rank, now));
        return item.id();
    }
}
