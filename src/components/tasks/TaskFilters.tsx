'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTaskStore } from '@/store/taskStore'
import { Search, X } from 'lucide-react'

export function TaskFilters() {
  const { filters, setFilters, clearFilters } = useTaskStore()
  const [search, setSearch] = useState(filters.search ?? '')

  const hasFilters =
    filters.status || filters.priority || filters.search || filters.dateFrom || filters.dateTo

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ ...filters, search: search || undefined })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={handleSearch} className="flex items-center gap-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="pl-8 w-48"
          />
        </div>
        <Button type="submit" size="sm" variant="outline">Search</Button>
      </form>

      <Select
        value={filters.status ?? 'ALL'}
        onValueChange={(v) => setFilters({ ...filters, status: v === 'ALL' ? undefined : v as string })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          <SelectItem value="TODO">To Do</SelectItem>
          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
          <SelectItem value="DONE">Done</SelectItem>
          <SelectItem value="CANCELLED">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.priority ?? 'ALL'}
        onValueChange={(v) => setFilters({ ...filters, priority: v === 'ALL' ? undefined : v as string })}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All priorities</SelectItem>
          <SelectItem value="URGENT">Urgent</SelectItem>
          <SelectItem value="HIGH">High</SelectItem>
          <SelectItem value="MEDIUM">Medium</SelectItem>
          <SelectItem value="LOW">Low</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('')
            clearFilters()
          }}
          className="text-gray-500 hover:text-gray-900"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
