package com.forgeboard.work.persistence;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.forgeboard.work.domain.WorkItem;

public interface WorkItemRepository extends JpaRepository<WorkItem, UUID> {
    List<WorkItem> findAllByFirmIdAndWorkflowIdOrderByStageIdAscRankAscIdAsc(UUID firmId, UUID workflowId);
    List<WorkItem> findAllByFirmIdOrderByDueDateAsc(UUID firmId);
    Optional<WorkItem> findByIdAndFirmIdAndWorkflowId(UUID id, UUID firmId, UUID workflowId);
    Optional<WorkItem> findByFirmIdAndWorkflowIdAndTaskReference(UUID firmId, UUID workflowId, String taskReference);

    @Query(value = "select 'FB-' || nextval('work_item_task_reference_sequence')", nativeQuery = true)
    String allocateTaskReference();

    @Query("select max(w.rank) from WorkItem w where w.firmId = :firmId and w.workflowId = :workflowId and w.stageId = :stageId")
    Optional<BigDecimal> maximumRank(@Param("firmId") UUID firmId,
            @Param("workflowId") UUID workflowId, @Param("stageId") UUID stageId);
}
