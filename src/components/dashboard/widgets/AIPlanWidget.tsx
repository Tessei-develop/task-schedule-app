'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, RefreshCw, Clock, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useUIStore } from '@/store/uiStore'
import type { DailyPlan } from '@/types'

function parseTimeSlot(slot: string): { startTime: string; endTime: string } {
  const match = slot.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i)
  if (!match) return { startTime: '', endTime: '' }
  return { startTime: to24h(match[1].trim()), endTime: to24h(match[2].trim()) }
}

function to24h(time: string): string {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return ''
  let h = parseInt(match[1])
  const m = match[2]
  const period = match[3].toUpperCase()
  if (period === 'AM' && h === 12) h = 0
  if (period === 'PM' && h !== 12) h += 12
  return `${h.toString().padStart(2, '0')}:${m}`
}

export function AIPlanWidget() {
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [cached, setCached] = useState(false)
  const { openTaskForm } = useUIStore()

  const fetchPlan = async (forceRefresh = false) => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh }),
      })
      if (!res.ok) throw new Error('Failed to generate plan')
      const data = await res.json()
      setPlan(data.plan)
      setCached(data.cached)
    } catch {
      toast.error('Failed to generate AI plan. Check your API key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-purple-500" />
          AI Daily Plan
          {cached && (
            <Badge variant="secondary" className="text-xs ml-1">cached</Badge>
          )}
          <div className="ml-auto flex gap-1">
            {plan && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => fetchPlan(true)}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!plan && !loading && (
          <div className="flex flex-col items-center py-6 gap-3">
            <p className="text-sm text-gray-500 text-center">
              Get an AI-powered schedule for your day based on your tasks.
            </p>
            <Button onClick={() => fetchPlan()} size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Today&apos;s Plan
            </Button>
          </div>
        )}

        {loading && (
          <div className="space-y-2 py-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        )}

        {plan && !loading && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
              {plan.introduction}
            </p>

            <div className="space-y-2">
              {plan.schedule.map((item, i) => {
                const times = parseTimeSlot(item.suggestedTimeSlot)
                return (
                  <div
                    key={i}
                    className="flex gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {item.suggestedTimeSlot}
                        </span>
                        <span className="text-xs text-gray-400">
                          {item.estimatedMinutes}min
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-400 line-clamp-1">{item.reasoning}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 flex-shrink-0 self-center text-gray-400 hover:text-indigo-600"
                      title="Add as task"
                      onClick={() =>
                        openTaskForm(undefined, undefined, {
                          title: item.title,
                          estimatedMinutes: item.estimatedMinutes?.toString(),
                          ...times,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>

            {plan.tips.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Tips</p>
                <ul className="space-y-1">
                  {plan.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                      <span className="text-purple-400">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
