package com.forgeboard.work.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.work.domain.WorkflowStage;

public interface WorkflowStageRepository extends JpaRepository<WorkflowStage, UUID> {
    List<WorkflowStage> findAllByFirmIdAndWorkflowIdOrderByPositionAsc(UUID firmId, UUID workflowId);
    List<WorkflowStage> findAllByFirmIdOrderByWorkflowIdAscPositionAsc(UUID firmId);
    Optional<WorkflowStage> findByIdAndFirmIdAndWorkflowId(UUID id, UUID firmId, UUID workflowId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select stage from WorkflowStage stage where stage.id = :id and stage.firmId = :firmId and stage.workflowId = :workflowId")
    Optional<WorkflowStage> findByIdAndFirmIdAndWorkflowIdForUpdate(UUID id, UUID firmId, UUID workflowId);
}
