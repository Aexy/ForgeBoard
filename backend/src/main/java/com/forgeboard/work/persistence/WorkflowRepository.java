package com.forgeboard.work.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.work.domain.WorkflowBoard;

public interface WorkflowRepository extends JpaRepository<WorkflowBoard, UUID> {
    Optional<WorkflowBoard> findByIdAndFirmId(UUID id, UUID firmId);
    boolean existsByIdAndFirmId(UUID id, UUID firmId);
    List<WorkflowBoard> findAllByFirmIdOrderByNameAsc(UUID firmId);
}
