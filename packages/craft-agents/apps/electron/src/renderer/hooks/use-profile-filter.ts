import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BrowserProfileConfig } from '../../shared/types'

export interface ProfileFilterState {
  searchQuery: string
  statusFilter: ('idle' | 'running' | 'error')[]
  platformFilter: string[]
  tagFilter: string[]
}

export interface ProfileSortState {
  field: 'name' | 'createdAt' | 'lastLaunchedAt' | 'status'
  direction: 'asc' | 'desc'
}

const FILTER_STORAGE_KEY = 'craft-agent:profile-filter'
const SORT_STORAGE_KEY = 'craft-agent:profile-sort'

const DEFAULT_FILTER: ProfileFilterState = {
  searchQuery: '',
  statusFilter: [],
  platformFilter: [],
  tagFilter: [],
}

const DEFAULT_SORT: ProfileSortState = {
  field: 'createdAt',
  direction: 'desc',
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    if (stored) return JSON.parse(stored)
  } catch {}
  return fallback
}

export function useProfileFilter(
  profiles: BrowserProfileConfig[],
  runningProfiles: Set<string>,
) {
  const [filter, setFilter] = useState<ProfileFilterState>(() =>
    loadFromStorage(FILTER_STORAGE_KEY, DEFAULT_FILTER),
  )
  const [sort, setSort] = useState<ProfileSortState>(() =>
    loadFromStorage(SORT_STORAGE_KEY, DEFAULT_SORT),
  )

  // Persist filter (except searchQuery - don't persist that)
  useEffect(() => {
    const toStore = { ...filter, searchQuery: '' }
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(toStore))
  }, [filter])

  // Persist sort
  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort))
  }, [sort])

  const setSearchQuery = useCallback((query: string) => {
    setFilter((prev) => ({ ...prev, searchQuery: query }))
  }, [])

  const toggleStatusFilter = useCallback(
    (status: 'idle' | 'running' | 'error') => {
      setFilter((prev) => ({
        ...prev,
        statusFilter: prev.statusFilter.includes(status)
          ? prev.statusFilter.filter((s) => s !== status)
          : [...prev.statusFilter, status],
      }))
    },
    [],
  )

  const setPlatformFilter = useCallback((platforms: string[]) => {
    setFilter((prev) => ({ ...prev, platformFilter: platforms }))
  }, [])

  const setTagFilter = useCallback((tags: string[]) => {
    setFilter((prev) => ({ ...prev, tagFilter: tags }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilter(DEFAULT_FILTER)
  }, [])

  const setSort_ = useCallback((field: ProfileSortState['field']) => {
    setSort((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const hasActiveFilters =
    filter.searchQuery !== '' ||
    filter.statusFilter.length > 0 ||
    filter.platformFilter.length > 0 ||
    filter.tagFilter.length > 0

  // All unique tags from profiles for tag filter options
  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    for (const p of profiles) {
      if (p.tags) {
        for (const t of p.tags) tags.add(t)
      }
    }
    return Array.from(tags).sort()
  }, [profiles])

  // All unique platforms
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>()
    for (const p of profiles) {
      if (p.platform) platforms.add(p.platform)
    }
    return Array.from(platforms).sort()
  }, [profiles])

  const filteredAndSorted = useMemo(() => {
    let result = [...profiles]

    // Search (fuzzy match on name, description, platform, tags, id)
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase()
      result = result.filter((p) => {
        const searchFields = [
          p.name,
          p.description || '',
          p.platform || '',
          p.id,
          ...(p.tags || []),
        ]
          .join(' ')
          .toLowerCase()
        return searchFields.includes(query)
      })
    }

    // Status filter
    if (filter.statusFilter.length > 0) {
      result = result.filter((p) => {
        const status = runningProfiles.has(p.id)
          ? 'running'
          : p.status || 'idle'
        return filter.statusFilter.includes(
          status as 'idle' | 'running' | 'error',
        )
      })
    }

    // Platform filter
    if (filter.platformFilter.length > 0) {
      result = result.filter((p) =>
        filter.platformFilter.includes(p.platform || ''),
      )
    }

    // Tag filter
    if (filter.tagFilter.length > 0) {
      result = result.filter(
        (p) => p.tags && filter.tagFilter.some((t) => p.tags!.includes(t)),
      )
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sort.field) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'createdAt':
          comparison = (a.createdAt || 0) - (b.createdAt || 0)
          break
        case 'lastLaunchedAt':
          comparison = (a.lastLaunchedAt || 0) - (b.lastLaunchedAt || 0)
          break
        case 'status': {
          const statusA = runningProfiles.has(a.id) ? 1 : 0
          const statusB = runningProfiles.has(b.id) ? 1 : 0
          comparison = statusA - statusB
          break
        }
      }
      return sort.direction === 'asc' ? comparison : -comparison
    })

    return result
  }, [profiles, filter, sort, runningProfiles])

  return {
    filter,
    sort,
    filteredProfiles: filteredAndSorted,
    setSearchQuery,
    toggleStatusFilter,
    setPlatformFilter,
    setTagFilter,
    clearFilters,
    setSortField: setSort_,
    hasActiveFilters,
    availableTags,
    availablePlatforms,
  }
}
