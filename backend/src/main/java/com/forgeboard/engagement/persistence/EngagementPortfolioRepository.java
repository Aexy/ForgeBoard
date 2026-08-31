package com.forgeboard.engagement.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import com.forgeboard.engagement.application.EngagementPortfolioRow;
import com.forgeboard.engagement.domain.Engagement;
import com.forgeboard.engagement.domain.EngagementStatus;

/** Purpose-built, tenant-scoped projection; never loads a portfolio into memory to filter it. */
public interface EngagementPortfolioRepository extends Repository<Engagement, UUID> {
    @Query(value = """
            select new com.forgeboard.engagement.application.EngagementPortfolioRow(
              e.id, e.clientId, c.displayName, e.templateId, t.name, e.templateVersion,
              preparer.userId, reviewer.userId, e.periodStart, e.periodEnd, e.dueDate, e.status,
              workflow.workflowSlug, item.taskReference,
              case when stage.attention = com.forgeboard.work.domain.StageAttention.BLOCKED then true else false end,
              case when stage.attention = com.forgeboard.work.domain.StageAttention.AWAITING_REVIEW then true else false end)
            from Engagement e
              join com.forgeboard.client.domain.ClientAccount c on c.id = e.clientId and c.firmId = e.firmId
              join com.forgeboard.engagement.domain.EngagementTemplate t on t.id = e.templateId and t.firmId = e.firmId
              left join com.forgeboard.work.domain.WorkItem item on item.id = e.workItemId and item.firmId = e.firmId
              left join com.forgeboard.work.domain.WorkflowBoard workflow on workflow.id = e.workflowId and workflow.firmId = e.firmId
              left join com.forgeboard.work.domain.WorkflowStage stage on stage.id = item.stageId and stage.firmId = e.firmId
              left join com.forgeboard.work.domain.WorkItemAssignment preparer on preparer.workItemId = e.workItemId
                    and preparer.firmId = e.firmId and preparer.assignmentRole = com.forgeboard.work.domain.AssignmentRole.OWNER
              left join com.forgeboard.work.domain.WorkItemAssignment reviewer on reviewer.workItemId = e.workItemId
                    and reviewer.firmId = e.firmId and reviewer.assignmentRole = com.forgeboard.work.domain.AssignmentRole.REVIEWER
            where e.firmId = :firmId
              and ((:statusEmpty = true and e.status not in (com.forgeboard.engagement.domain.EngagementStatus.COMPLETE,
                    com.forgeboard.engagement.domain.EngagementStatus.CANCELLED, com.forgeboard.engagement.domain.EngagementStatus.ARCHIVED))
                   or (:statusEmpty = false and e.status in :statuses))
              and (:query is null or lower(c.displayName) like lower(concat('%', :query, '%'))
                    or lower(c.legalName) like lower(concat('%', :query, '%'))
                    or lower(t.name) like lower(concat('%', :query, '%'))
                    or lower(item.taskReference) like lower(concat('%', :query, '%')))
              and (:clientId is null or e.clientId = :clientId)
              and (:templateId is null or e.templateId = :templateId)
              and (:preparerUserId is null or preparer.userId = :preparerUserId)
              and (:reviewerUserId is null or reviewer.userId = :reviewerUserId)
              and (:periodStart is null or e.periodStart >= :periodStart)
              and (:periodEnd is null or e.periodEnd <= :periodEnd)
              and (:attentionEmpty = true
                    or (:overdue = true and e.dueDate < :today)
                    or (:dueSoon = true and e.dueDate >= :today and e.dueDate <= :dueSoonDate)
                    or (:blocked = true and (e.status = com.forgeboard.engagement.domain.EngagementStatus.BLOCKED
                         or stage.attention = com.forgeboard.work.domain.StageAttention.BLOCKED))
                    or (:unassigned = true and preparer.id is null)
                    or (:awaitingReview = true and (e.status = com.forgeboard.engagement.domain.EngagementStatus.AWAITING_REVIEW
                         or stage.attention = com.forgeboard.work.domain.StageAttention.AWAITING_REVIEW)))
            order by e.dueDate asc nulls last, e.periodStart desc, lower(c.displayName) asc, e.id asc
            """,
            countQuery = """
            select count(e)
            from Engagement e
              join com.forgeboard.client.domain.ClientAccount c on c.id = e.clientId and c.firmId = e.firmId
              join com.forgeboard.engagement.domain.EngagementTemplate t on t.id = e.templateId and t.firmId = e.firmId
              left join com.forgeboard.work.domain.WorkItem item on item.id = e.workItemId and item.firmId = e.firmId
              left join com.forgeboard.work.domain.WorkflowStage stage on stage.id = item.stageId and stage.firmId = e.firmId
              left join com.forgeboard.work.domain.WorkItemAssignment preparer on preparer.workItemId = e.workItemId
                    and preparer.firmId = e.firmId and preparer.assignmentRole = com.forgeboard.work.domain.AssignmentRole.OWNER
              left join com.forgeboard.work.domain.WorkItemAssignment reviewer on reviewer.workItemId = e.workItemId
                    and reviewer.firmId = e.firmId and reviewer.assignmentRole = com.forgeboard.work.domain.AssignmentRole.REVIEWER
            where e.firmId = :firmId
              and ((:statusEmpty = true and e.status not in (com.forgeboard.engagement.domain.EngagementStatus.COMPLETE,
                    com.forgeboard.engagement.domain.EngagementStatus.CANCELLED, com.forgeboard.engagement.domain.EngagementStatus.ARCHIVED))
                   or (:statusEmpty = false and e.status in :statuses))
              and (:query is null or lower(c.displayName) like lower(concat('%', :query, '%'))
                    or lower(c.legalName) like lower(concat('%', :query, '%'))
                    or lower(t.name) like lower(concat('%', :query, '%'))
                    or lower(item.taskReference) like lower(concat('%', :query, '%')))
              and (:clientId is null or e.clientId = :clientId)
              and (:templateId is null or e.templateId = :templateId)
              and (:preparerUserId is null or preparer.userId = :preparerUserId)
              and (:reviewerUserId is null or reviewer.userId = :reviewerUserId)
              and (:periodStart is null or e.periodStart >= :periodStart)
              and (:periodEnd is null or e.periodEnd <= :periodEnd)
              and (:attentionEmpty = true
                    or (:overdue = true and e.dueDate < :today)
                    or (:dueSoon = true and e.dueDate >= :today and e.dueDate <= :dueSoonDate)
                    or (:blocked = true and (e.status = com.forgeboard.engagement.domain.EngagementStatus.BLOCKED
                         or stage.attention = com.forgeboard.work.domain.StageAttention.BLOCKED))
                    or (:unassigned = true and preparer.id is null)
                    or (:awaitingReview = true and (e.status = com.forgeboard.engagement.domain.EngagementStatus.AWAITING_REVIEW
                         or stage.attention = com.forgeboard.work.domain.StageAttention.AWAITING_REVIEW)))
            """)
    Page<EngagementPortfolioRow> findPortfolio(@Param("firmId") UUID firmId, @Param("query") String query,
            @Param("clientId") UUID clientId, @Param("templateId") UUID templateId,
            @Param("preparerUserId") UUID preparerUserId, @Param("reviewerUserId") UUID reviewerUserId,
            @Param("periodStart") LocalDate periodStart, @Param("periodEnd") LocalDate periodEnd,
            @Param("statusEmpty") boolean statusEmpty, @Param("statuses") List<EngagementStatus> statuses,
            @Param("attentionEmpty") boolean attentionEmpty, @Param("overdue") boolean overdue,
            @Param("dueSoon") boolean dueSoon, @Param("blocked") boolean blocked, @Param("unassigned") boolean unassigned,
            @Param("awaitingReview") boolean awaitingReview, @Param("today") LocalDate today,
            @Param("dueSoonDate") LocalDate dueSoonDate, Pageable pageable);
}
