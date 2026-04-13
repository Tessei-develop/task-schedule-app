'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, RefreshCw, ThumbsUp, Target, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import type { ProductivityFeedback } from '@/types'

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? 'bg-green-100 text-green-700' :
    score >= 5 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-700'
  return (
    <span className={`${color} text-lg font-bold px-3 py-1 rounded-full`}>
      {score}/10
    </span>
  )
}

export function AIFeedbackWidget() {
  const [feedback, setFeedback] = useState<ProductivityFeedback | null>(null)
  const [loading, setLoading] = useState(false)
  const [cached, setCached] = useState(false)

  const fetchFeedback = async (forceRefresh = false) => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodDays: 7, forceRefresh }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setFeedback(data.feedback)
      setCached(data.cached)
    } catch {
      toast.error('Failed to generate feedback. Check your API key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-pink-500" />
          AI Productivity Feedback
          {cached && (
            <Badge variant="secondary" className="text-xs ml-1">cached</Badge>
          )}
          {feedback && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 ml-auto"
              onClick={() => fetchFeedback(true)}
              disabled={loading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!feedback && !loading && (
          <div className="flex flex-col items-center py-6 gap-3">
            <p className="text-sm text-gray-500 text-center">
              Get honest AI feedback on your productivity over the last 7 days.
            </p>
            <Button onClick={() => fetchFeedback()} size="sm">
              <Brain className="h-4 w-4 mr-2" />
              Get Feedback
            </Button>
          </div>
        )}

        {loading && (
          <div className="space-y-2 py-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        )}

        {feedback && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ScoreBadge score={feedback.score} />
              <div>
                <p className="text-xs text-gray-500">{feedback.period}</p>
                <p className="text-sm font-semibold">{feedback.completionRate}% completion rate</p>
              </div>
            </div>

            {feedback.strengths.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-semibold text-green-600 mb-1">
                  <ThumbsUp className="h-3 w-3" /> Strengths
                </p>
                <ul className="space-y-0.5">
                  {feedback.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-1.5">
                      <span className="text-green-400">•</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {feedback.areasToImprove.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-semibold text-orange-600 mb-1">
                  <Target className="h-3 w-3" /> Areas to Improve
                </p>
                <ul className="space-y-0.5">
                  {feedback.areasToImprove.map((a, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-1.5">
                      <span className="text-orange-400">•</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {feedback.actionableAdvice.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-semibold text-blue-600 mb-1">
                  <Lightbulb className="h-3 w-3" /> Action Items
                </p>
                <ul className="space-y-0.5">
                  {feedback.actionableAdvice.map((a, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-1.5">
                      <span className="text-blue-400">•</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {feedback.motivationalMessage && (
              <p className="text-xs text-gray-500 italic border-t pt-3">
                &ldquo;{feedback.motivationalMessage}&rdquo;
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
