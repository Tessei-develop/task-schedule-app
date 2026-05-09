import { OverdueWidget } from '@/components/dashboard/widgets/OverdueWidget'
import { TodayTasksWidget } from '@/components/dashboard/widgets/TodayTasksWidget'
import { UpcomingWidget } from '@/components/dashboard/widgets/UpcomingWidget'
import { CompletionRateWidget } from '@/components/dashboard/widgets/CompletionRateWidget'
import { WeekProgressWidget } from '@/components/dashboard/widgets/WeekProgressWidget'
import { AIPlanWidget } from '@/components/dashboard/widgets/AIPlanWidget'
import { AIFeedbackWidget } from '@/components/dashboard/widgets/AIFeedbackWidget'

export default function DashboardPage() {
  return (
    <div className="flex-1 overflow-y-auto">
    <div className="p-4 pb-28 md:pb-6 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>

      {/* Row 1+2: Status / Stats widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <OverdueWidget />
        <TodayTasksWidget />
        <CompletionRateWidget />
        <WeekProgressWidget />
      </div>

      {/* Row 3: AI widgets — always side by side from lg up so Feedback sits
          right next to the Daily Plan rather than stacking below it */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <AIPlanWidget />
        <AIFeedbackWidget />
      </div>

      {/* Row 4: Upcoming — full width so the long list doesn't crowd other widgets */}
      <div className="mt-4">
        <UpcomingWidget />
      </div>
    </div>
    </div>
  )
}
