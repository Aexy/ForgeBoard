package com.forgeboard.work.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.forgeboard.work.domain.SavedWorkflowView;

public interface SavedWorkflowViewRepository extends JpaRepository<SavedWorkflowView, UUID> {
    List<SavedWorkflowView> findAllByFirmIdOrderByNameAsc(UUID firmId);

    Optional<SavedWorkflowView> findByIdAndFirmId(UUID id, UUID firmId);

    long deleteByIdAndFirmId(UUID id, UUID firmId);
}
