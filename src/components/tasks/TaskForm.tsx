'use client'

import { useEffect, useState } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useTaskStore } from '@/store/taskStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { X, Plus, Trash2 } from 'lucide-react'
import type { Task, TaskPriority, TaskStatus, RecurrenceType } from '@/types'
import { PRESET_TAGS } from '@/types'

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const
const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKDAY', label: 'Every weekday (Mon–Fri)' },
  { value: 'WEEKEND', label: 'Every weekend (Sat–Sun)' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY',  label: 'Yearly' },
]

// WEEKDAY/WEEKEND don't take a numeric interval — the cadence is implicit
const HAS_INTERVAL: Record<string, boolean> = {
  DAILY: true, WEEKLY: true, MONTHLY: true, YEARLY: true,
  WEEKDAY: false, WEEKEND: false,
}

interface FormState {
  title: string
  description: string
  priority: string
  status: string
  startDate: string
  dueDate: string
  startTime: string
  endTime: string
  estimatedMinutes: string
  tags: string[]
  recurrence: string        // '' = none
  recurrenceInterval: string
  recurrenceEndDate: string
}

const defaultForm: FormState = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  status: 'TODO',
  startDate: '',
  dueDate: '',
  startTime: '',
  endTime: '',
  estimatedMinutes: '',
  tags: [],
  recurrence: '',
  recurrenceInterval: '1',
  recurrenceEndDate: '',
}

export function TaskForm() {
  const { isTaskFormOpen, editingTaskId, prefillDate, prefillData, closeTaskForm } = useUIStore()
  const { tasks, createTask, updateTask, deleteTask } = useTaskStore()
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [customTagInput, setCustomTagInput] = useState('')

  const editingTask: Task | undefined = editingTaskId
    ? tasks.find((t) => t.id === editingTaskId)
    : undefined

  useEffect(() => {
    if (!isTaskFormOpen) return
    if (editingTask) {
      setForm({
        title: editingTask.title,
        description: editingTask.description ?? '',
        priority: editingTask.priority,
        status: editingTask.status,
        startDate: editingTask.startDate?.slice(0, 10) ?? '',
        dueDate: editingTask.dueDate?.slice(0, 10) ?? '',
        startTime: editingTask.startTime ?? '',
        endTime: editingTask.endTime ?? '',
        estimatedMinutes: editingTask.estimatedMinutes?.toString() ?? '',
        tags: editingTask.tags ?? [],
        recurrence: editingTask.recurrence ?? '',
        recurrenceInterval: editingTask.recurrenceInterval?.toString() ?? '1',
        recurrenceEndDate: editingTask.recurrenceEndDate?.slice(0, 10) ?? '',
      })
    } else {
      setForm({
        ...defaultForm,
        dueDate: prefillDate ?? '',
        ...(prefillData ?? {}),
      })
    }
    setCustomTagInput('')
    setConfirmDelete(false)
  }, [isTaskFormOpen, editingTask, prefillDate, prefillData])

  const handleDelete = async () => {
    if (!editingTaskId) return
    setDeleting(true)
    try {
      await deleteTask(editingTaskId)
      toast.success('Task deleted')
      closeTaskForm()
    } catch {
      toast.error('Failed to delete task')
      setDeleting(false)
    }
  }

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))
  }

  const addCustomTag = () => {
    const tag = customTagInput.trim().toLowerCase()
    if (!tag || form.tags.includes(tag)) return
    setForm((f) => ({ ...f, tags: [...f.tags, tag] }))
    setCustomTagInput('')
  }

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return

    // Recurrence requires both a due date and an end date so the series has
    // an anchor and a stop point. Show a friendly error before submitting.
    if (form.recurrence) {
      if (!form.dueDate) {
        toast.error('Please set a due date for the first occurrence.')
        return
      }
      if (!form.recurrenceEndDate) {
        toast.error('Please set a recurrence end date so the series stops.')
        return
      }
      if (form.recurrenceEndDate < form.dueDate) {
        toast.error('Recurrence end date must be on or after the due date.')
        return
      }
    }

    setSaving(true)
    try {
      const data: Partial<Task> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority as TaskPriority,
        status: form.status as TaskStatus,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : null,
        tags: form.tags,
        recurrence: (form.recurrence as RecurrenceType) || null,
        recurrenceInterval:
          form.recurrence && HAS_INTERVAL[form.recurrence]
            ? parseInt(form.recurrenceInterval) || 1
            : null,
        recurrenceEndDate: form.recurrence && form.recurrenceEndDate ? form.recurrenceEndDate : null,
      }

      if (editingTaskId) {
        await updateTask(editingTaskId, data)
        toast.success('Task updated')
        closeTaskForm()
      } else {
        const { occurrencesCreated } = await createTask(data)
        if (occurrencesCreated > 0) {
          toast.success(`Created ${occurrencesCreated + 1} occurrences. Pushing to Google Calendar…`)
        } else {
          toast.success('Task created')
        }
        closeTaskForm()

        // If extra occurrences were generated, kick off a sync so they push to
        // Google Calendar right away instead of waiting for the next cron.
        if (occurrencesCreated > 0) {
          fetch('/api/google/sync', { method: 'POST' })
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json().catch(() => ({}))
                if (data.pushed) toast.success(`Pushed ${data.pushed} tasks to Google Calendar`)
              }
            })
            .catch(() => { /* best-effort */ })
        }
      }
    } catch {
      toast.error('Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  const setField = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }))

  // Tags that are not presets (custom ones)
  const customTags = form.tags.filter((t) => !(PRESET_TAGS as readonly string[]).includes(t))

  return (
    <Dialog open={isTaskFormOpen} onOpenChange={(open) => !open && closeTaskForm()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTaskId ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={setField('title')}
              placeholder="Task title"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={setField('description')}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v ?? '' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v ?? '' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={form.startDate} onChange={setField('startDate')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" value={form.dueDate} onChange={setField('dueDate')} />
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startTime">Start Time</Label>
              <Input id="startTime" type="time" value={form.startTime} onChange={setField('startTime')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endTime">End Time</Label>
              <Input id="endTime" type="time" value={form.endTime} onChange={setField('endTime')} />
            </div>
          </div>

          {/* Est. minutes */}
          <div className="space-y-1">
            <Label htmlFor="est">Estimated Minutes</Label>
            <Input
              id="est"
              type="number"
              min="1"
              value={form.estimatedMinutes}
              onChange={setField('estimatedMinutes')}
              placeholder="e.g. 60"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            {/* Preset tag buttons */}
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                    form.tags.includes(tag)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {/* Custom tag input */}
            <div className="flex gap-2">
              <Input
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                placeholder="Add custom tag..."
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addCustomTag() }
                }}
              />
              <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={addCustomTag}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {/* All selected tags (show custom ones with remove button) */}
            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {customTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs capitalize">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Recurrence */}
          <div className="space-y-2 border rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
            <Label>Recurrence</Label>
            <Select
              value={form.recurrence || 'none'}
              onValueChange={(v) => setForm((f) => ({ ...f, recurrence: v === 'none' ? '' : (v ?? '') }))}
            >
              <SelectTrigger><SelectValue placeholder="Does not repeat" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                {RECURRENCE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {form.recurrence && (
              <>
                <div className={`grid gap-3 pt-1 ${HAS_INTERVAL[form.recurrence] ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {HAS_INTERVAL[form.recurrence] && (
                    <div className="space-y-1">
                      <Label htmlFor="recurrenceInterval" className="text-xs text-gray-500">
                        Every
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="recurrenceInterval"
                          type="number"
                          min="1"
                          max="99"
                          value={form.recurrenceInterval}
                          onChange={setField('recurrenceInterval')}
                          className="w-16"
                        />
                        <span className="text-sm text-gray-500">
                          {form.recurrence === 'DAILY'   && 'day(s)'}
                          {form.recurrence === 'WEEKLY'  && 'week(s)'}
                          {form.recurrence === 'MONTHLY' && 'month(s)'}
                          {form.recurrence === 'YEARLY'  && 'year(s)'}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="recurrenceEndDate" className="text-xs text-gray-500">
                      End Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="recurrenceEndDate"
                      type="date"
                      value={form.recurrenceEndDate}
                      onChange={setField('recurrenceEndDate')}
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                  All occurrences from the due date through the end date will be created at once.
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {/* Delete button — only when editing an existing task */}
            <div>
              {editingTaskId && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      Delete this task?
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Yes, delete'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )
              )}
            </div>

            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={closeTaskForm}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingTaskId ? 'Save Changes' : 'Create Task'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
