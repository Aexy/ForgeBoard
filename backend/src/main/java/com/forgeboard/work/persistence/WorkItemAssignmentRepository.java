package com.forgeboard.work.persistence;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import com.forgeboard.work.application.EmployeeWorkItemView;
import com.forgeboard.work.application.OwnerAssignmentView;
import com.forgeboard.work.domain.AssignmentRole;
import com.forgeboard.work.domain.WorkItemAssignment;

public interface WorkItemAssignmentRepository extends JpaRepository<WorkItemAssignment, UUID> {
    @Modifying(flushAutomatically = true)
    @Query("delete from WorkItemAssignment a where a.firmId = :firmId and a.workItemId = :workItemId and a.assignmentRole = :role")
    void deleteByFirmIdAndWorkItemIdAndAssignmentRole(@Param("firmId") UUID firmId,
            @Param("workItemId") UUID workItemId, @Param("role") AssignmentRole role);

    @Query("select new com.forgeboard.work.application.OwnerAssignmentView(a.workItemId, a.userId) from WorkItemAssignment a " +
            "where a.firmId = :firmId and a.assignmentRole = com.forgeboard.work.domain.AssignmentRole.OWNER and a.workItemId in :itemIds")
    List<OwnerAssignmentView> findOwnersByFirmIdAndWorkItemIdIn(@Param("firmId") UUID firmId, @Param("itemIds") List<UUID> itemIds);

    @Query("select new com.forgeboard.work.application.EmployeeWorkItemView(w.id, w.title, w.workflowId, w.stageId, s.name, w.dueDate) " +
            "from WorkItemAssignment a join WorkItem w on w.id = a.workItemId and w.firmId = a.firmId " +
            "join WorkflowStage s on s.id = w.stageId and s.firmId = w.firmId " +
            "where a.firmId = :firmId and a.userId = :userId and :today is not null and a.assignmentRole = com.forgeboard.work.domain.AssignmentRole.OWNER " +
            "order by w.dueDate asc nulls last, w.id asc")
    List<EmployeeWorkItemView> findDashboardByFirmIdAndUserId(@Param("firmId") UUID firmId,
            @Param("userId") UUID userId, @Param("today") LocalDate today);
}
