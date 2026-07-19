'use client'

import type { FirmContext } from '@/lib/firm-context'
import { type CreateWorkItemDetails, type WorkItem, useCreateWorkItemMutation, useMoveWorkItemMutation, useUpdateWorkItemOwnerMutation, useUpdateWorkItemReviewerMutation } from './workflow-transport'

function statusOf(error: unknown) { return typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: number }).status : undefined }

export function useBoardOperations({ firm, workflowId, refetchBoard }: Readonly<{ firm: FirmContext; workflowId: string; refetchBoard: () => unknown }>) {
  const [createWorkItem, createResult] = useCreateWorkItemMutation()
  const [moveWorkItem, moveResult] = useMoveWorkItemMutation()
  const [updateOwner, ownerResult] = useUpdateWorkItemOwnerMutation()
  const [updateReviewer, reviewerResult] = useUpdateWorkItemReviewerMutation()
  return {
    create: (stageId: string, details: Omit<CreateWorkItemDetails, 'stageId'>) => createWorkItem({ firm, workflowId, details: { ...details, stageId } }).unwrap(),
    move: async (item: WorkItem, stageId: string) => {
      try { return await moveWorkItem({ firm, workflowId, itemId: item.id, targetStageId: stageId, expectedVersion: item.version }).unwrap() }
      catch (error) { if (statusOf(error) === 409) { await refetchBoard(); throw new Error('This work item was changed by another user. The board was refreshed; retry your move.') } throw error }
    },
    assignOwner: (itemId: string, ownerUserId: string | null) => updateOwner({ firm, workflowId, itemId, ownerUserId }).unwrap(),
    assignReviewer: (itemId: string, userId: string | null) => updateReviewer({ firm, workflowId, itemId, userId }).unwrap(),
    isSaving: createResult.isLoading || moveResult.isLoading || ownerResult.isLoading || reviewerResult.isLoading,
  }
}
