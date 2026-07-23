import { PlatformAdminDashboard } from '@/features/platform-admin/PlatformAdminDashboard'

/**
 * The isolated platform-admin feature owns the dashboard UI. This route shell
 * establishes the protected server boundary before that feature is mounted.
 */
export default function PlatformAdminPage() {
  return <main><PlatformAdminDashboard /></main>
}
