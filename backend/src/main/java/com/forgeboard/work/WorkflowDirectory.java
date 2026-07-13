package com.forgeboard.work;

import java.util.UUID;
import org.springframework.stereotype.Service;
import com.forgeboard.work.persistence.WorkflowRepository;

@Service
public class WorkflowDirectory {
    private final WorkflowRepository workflows;
    public WorkflowDirectory(WorkflowRepository workflows) { this.workflows = workflows; }
    public boolean exists(UUID firmId, UUID workflowId) { return workflows.existsByIdAndFirmId(workflowId, firmId); }
}
