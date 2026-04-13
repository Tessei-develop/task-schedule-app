'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useTaskStore } from '@/store/taskStore'
import { Flag } from 'lucide-react'

const COLORS = {
  URGENT: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#6366f1',
  LOW: '#9ca3af',
}

export function PriorityBreakdownWidget() {
  const { tasks, fetchTasks } = useTaskStore()

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const openTasks = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED')

  const data = (['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const)
    .map((priority) => ({
      name: priority,
      value: openTasks.filter((t) => t.priority === priority).length,
    }))
    .filter((d) => d.value > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flag className="h-4 w-4 text-orange-500" />
          Open Tasks by Priority
        </CardTitle>
      </CardHeader>
      <CardContent>
        {openTasks.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No open tasks</p>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={80} height={80}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={38}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[entry.name as keyof typeof COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} tasks`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1">
              {data.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[entry.name as keyof typeof COLORS] }}
                  />
                  <span className="text-gray-600 dark:text-gray-400">{entry.name}</span>
                  <span className="font-semibold text-gray-900 dark:text-white ml-auto">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
