import type { StageAttention } from './workflows'

export type EmployeeWorkItem = { id: string; title: string; workflowId: string; stageId: string; stageName: string; attention: StageAttention; dueDate: string | null }
export type EmployeeDashboard = { today: string; overdue: EmployeeWorkItem[]; dueSoon: EmployeeWorkItem[]; blocked: EmployeeWorkItem[]; awaitingReview: EmployeeWorkItem[]; active: EmployeeWorkItem[] }
export const employeeDashboardKey = (firmId: string) => ['employee-dashboard', firmId] as const
export async function getMyWorkDashboard(firmId: string): Promise<EmployeeDashboard> {
  const response = await fetch('/api/dashboard/my-work', { cache: 'no-store', credentials: 'include', headers: { 'X-ForgeBoard-Firm': firmId } })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  return response.json() as Promise<EmployeeDashboard>
}
