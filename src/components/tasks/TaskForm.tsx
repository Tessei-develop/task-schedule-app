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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { Task } from '@/types'

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const

interface FormState {
  title: string
  description: string
  priority: string
  status: string
  startDate: string
  dueDate: string
  estimatedMinutes: string
  tags: string
}

const defaultForm: FormState = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  status: 'TODO',
  startDate: '',
  dueDate: '',
  estimatedMinutes: '',
  tags: '',
}

export function TaskForm() {
  const { isTaskFormOpen, editingTaskId, prefillDate, closeTaskForm } = useUIStore()
  const { tasks, createTask, updateTask } = useTaskStore()
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saving, setSaving] = useState(false)

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
        estimatedMinutes: editingTask.estimatedMinutes?.toString() ?? '',
        tags: editingTask.tags.join(', '),
      })
    } else {
      setForm({
        ...defaultForm,
        dueDate: prefillDate ?? '',
      })
    }
  }, [isTaskFormOpen, editingTask, prefillDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return

    setSaving(true)
    try {
      const data: Partial<import('@/types').Task> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority as import('@/types').TaskPriority,
        status: form.status as import('@/types').TaskStatus,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : null,
        tags: form.tags
          ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [],
      }

      if (editingTaskId) {
        await updateTask(editingTaskId, data)
        toast.success('Task updated')
      } else {
        await createTask(data)
        toast.success('Task created')
      }
      closeTaskForm()
    } catch {
      toast.error('Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <Dialog open={isTaskFormOpen} onOpenChange={(open) => !open && closeTaskForm()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTaskId ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={set('title')}
              placeholder="Task title"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={set('description')}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v as string }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as string }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={set('startDate')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={form.dueDate}
                onChange={set('dueDate')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="est">Est. Minutes</Label>
              <Input
                id="est"
                type="number"
                min="1"
                value={form.estimatedMinutes}
                onChange={set('estimatedMinutes')}
                placeholder="e.g. 60"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={set('tags')}
                placeholder="work, personal, ..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeTaskForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingTaskId ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
