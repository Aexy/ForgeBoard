package com.forgeboard.work.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.forgeboard.work.domain.WorkItemDocumentRequest;
import com.forgeboard.work.domain.WorkItemDocumentRequestId;

public interface WorkItemDocumentRequestRepository
        extends JpaRepository<WorkItemDocumentRequest, WorkItemDocumentRequestId> {
    List<WorkItemDocumentRequest> findAllByFirmIdAndWorkItemId(UUID firmId, UUID workItemId);

    boolean existsByFirmIdAndDocumentRequestId(UUID firmId, UUID documentRequestId);

    long deleteByFirmIdAndWorkItemIdAndDocumentRequestId(UUID firmId, UUID workItemId, UUID documentRequestId);
}
