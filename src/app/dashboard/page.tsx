import { OverdueWidget } from '@/components/dashboard/widgets/OverdueWidget'
import { TodayTasksWidget } from '@/components/dashboard/widgets/TodayTasksWidget'
import { UpcomingWidget } from '@/components/dashboard/widgets/UpcomingWidget'
import { CompletionRateWidget } from '@/components/dashboard/widgets/CompletionRateWidget'
import { PriorityBreakdownWidget } from '@/components/dashboard/widgets/PriorityBreakdownWidget'
import { WeekProgressWidget } from '@/components/dashboard/widgets/WeekProgressWidget'
import { AIPlanWidget } from '@/components/dashboard/widgets/AIPlanWidget'
import { AIFeedbackWidget } from '@/components/dashboard/widgets/AIFeedbackWidget'

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Row 1: Status overview */}
        <OverdueWidget />
        <TodayTasksWidget />
        <UpcomingWidget />

        {/* Row 2: Stats */}
        <CompletionRateWidget />
        <PriorityBreakdownWidget />
        <WeekProgressWidget />

        {/* Row 3: AI widgets — full width on smaller screens */}
        <div className="sm:col-span-2 xl:col-span-1">
          <AIPlanWidget />
        </div>
        <div className="sm:col-span-2 xl:col-span-2">
          <AIFeedbackWidget />
        </div>
      </div>
    </div>
  )
}
