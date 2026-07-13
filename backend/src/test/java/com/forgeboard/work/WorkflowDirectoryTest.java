package com.forgeboard.work;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.forgeboard.work.domain.WorkItem;
import com.forgeboard.work.domain.WorkPriority;
import com.forgeboard.work.domain.WorkflowStage;
import com.forgeboard.work.persistence.WorkItemRepository;
import com.forgeboard.work.persistence.WorkflowRepository;
import com.forgeboard.work.persistence.WorkflowStageRepository;

@ExtendWith(MockitoExtension.class)
class WorkflowDirectoryTest {
    @Mock WorkflowRepository workflows;
    @Mock WorkflowStageRepository stages;
    @Mock WorkItemRepository items;
    WorkflowDirectory directory;
    Instant now;

    @BeforeEach
    void setUp() {
        directory = new WorkflowDirectory(workflows, stages, items);
        now = Instant.parse("2026-07-13T09:00:00Z");
    }

    @Test
    void createsAnInitialWorkItemInTheFirstWorkflowStage() {
        UUID firmId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();
        UUID stageId = UUID.randomUUID();
        when(workflows.existsByIdAndFirmId(workflowId, firmId)).thenReturn(true);
        when(stages.findAllByFirmIdAndWorkflowIdOrderByPositionAsc(firmId, workflowId))
                .thenReturn(List.of(new WorkflowStage(stageId, firmId, workflowId, "Intake", 0, now)));
        when(items.maximumRank(firmId, workflowId, stageId)).thenReturn(Optional.of(new BigDecimal("2000")));
        when(items.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        UUID itemId = directory.createInitialWorkItem(firmId, clientId, workflowId, "VAT Q2 2026",
                "Generated from VAT returns.", LocalDate.of(2026, 6, 20), now);

        ArgumentCaptor<WorkItem> saved = ArgumentCaptor.forClass(WorkItem.class);
        org.mockito.Mockito.verify(items).save(saved.capture());
        assertThat(itemId).isEqualTo(saved.getValue().id());
        assertThat(saved.getValue().stageId()).isEqualTo(stageId);
        assertThat(saved.getValue().rank()).isEqualByComparingTo("3000");
        assertThat(saved.getValue().priority()).isEqualTo(WorkPriority.NORMAL);
    }
}
