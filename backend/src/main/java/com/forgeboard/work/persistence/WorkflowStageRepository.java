package com.forgeboard.work.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.work.domain.WorkflowStage;

public interface WorkflowStageRepository extends JpaRepository<WorkflowStage, UUID> {
    List<WorkflowStage> findAllByFirmIdAndWorkflowIdOrderByPositionAsc(UUID firmId, UUID workflowId);
    Optional<WorkflowStage> findByIdAndFirmIdAndWorkflowId(UUID id, UUID firmId, UUID workflowId);
}

