'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTaskStore } from '@/store/taskStore'
import { Search, ChevronDown, X, Check } from 'lucide-react'

// ─── Generic multi-select dropdown ───────────────────────────────────────────

interface Option { value: string; label: string }

interface MultiSelectProps {
  label: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  const pluralLabel = label.endsWith('s') ? `${label}es`
    : label.endsWith('y') ? `${label.slice(0, -1)}ies`
    : `${label}s`

  const displayLabel =
    selected.length === 0 || selected.length === options.length
      ? `All ${pluralLabel}`
      : selected.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')

  return (
    <div ref={ref} className="relative">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 ml-0.5">
        {label}
      </p>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm shadow-sm hover:bg-accent hover:text-accent-foreground min-w-[130px] max-w-[220px] truncate"
      >
        <span className="flex-1 text-left truncate">{displayLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[160px] rounded-md border bg-popover shadow-md">
          {options.map((opt) => {
            const checked = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
              >
                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-input'}`}>
                  {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Options ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Option[] = [
  { value: 'TODO',        label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE',        label: 'Done' },
  { value: 'CANCELLED',   label: 'Cancelled' },
]

const PRIORITY_OPTIONS: Option[] = [
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH',   label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW',    label: 'Low' },
]

// ─── Main filter bar ──────────────────────────────────────────────────────────

export function TaskFilters() {
  const { filters, setFilters, clearFilters, tasks } = useTaskStore()
  const [search, setSearch] = useState(filters.search ?? '')

  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags))).sort()
  const tagOptions: Option[] = allTags.map((t) => ({ value: t, label: t }))

  const selectedStatuses   = filters.status   ?? []
  const selectedPriorities = filters.priority ?? []
  const selectedTags       = filters.tags     ?? []

  const hasFilters =
    selectedStatuses.length > 0 ||
    selectedPriorities.length > 0 ||
    selectedTags.length > 0 ||
    filters.search

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ ...filters, search: search || undefined })
  }

  return (
    <div className="flex flex-wrap items-end gap-2 md:gap-3">
      {/* Search */}
      <div>
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 ml-0.5">Search</p>
        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 w-36 md:w-44"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">Search</Button>
        </form>
      </div>

      <MultiSelect label="Status"   options={STATUS_OPTIONS}   selected={selectedStatuses}   onChange={(v) => setFilters({ ...filters, status: v })} />
      <MultiSelect label="Priority" options={PRIORITY_OPTIONS} selected={selectedPriorities} onChange={(v) => setFilters({ ...filters, priority: v })} />
      {tagOptions.length > 0 && (
        <MultiSelect label="Tag" options={tagOptions} selected={selectedTags} onChange={(v) => setFilters({ ...filters, tags: v })} />
      )}

      {/* Active filter badges */}
      {hasFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedStatuses.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1 text-xs">
              {STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, status: selectedStatuses.filter((v) => v !== s) })} />
            </Badge>
          ))}
          {selectedPriorities.map((p) => (
            <Badge key={p} variant="secondary" className="gap-1 text-xs">
              {PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, priority: selectedPriorities.filter((v) => v !== p) })} />
            </Badge>
          ))}
          {selectedTags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 text-xs">
              #{t}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, tags: selectedTags.filter((v) => v !== t) })} />
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); clearFilters() }} className="h-7 px-2 text-xs text-gray-500 hover:text-gray-900">
            <X className="h-3 w-3 mr-1" />Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
