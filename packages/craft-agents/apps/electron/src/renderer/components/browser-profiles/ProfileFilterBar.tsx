import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ProfileFilterState,
  ProfileSortState,
} from '@/hooks/use-profile-filter'

interface ProfileFilterBarProps {
  filter: ProfileFilterState
  sort: ProfileSortState
  onSearchChange: (query: string) => void
  onToggleStatus: (status: 'idle' | 'running' | 'error') => void
  onPlatformChange: (platforms: string[]) => void
  onTagChange: (tags: string[]) => void
  onSortChange: (field: ProfileSortState['field']) => void
  onClear: () => void
  hasActiveFilters: boolean
  availableTags: string[]
  availablePlatforms: string[]
  resultCount: number
  totalCount: number
}

const STATUS_OPTIONS = [
  {
    value: 'running' as const,
    label: 'Running',
    color: 'bg-success/10 text-success border-success/30',
  },
  {
    value: 'idle' as const,
    label: 'Idle',
    color: 'bg-foreground/5 text-foreground/60 border-foreground/10',
  },
  {
    value: 'error' as const,
    label: 'Error',
    color: 'bg-destructive/10 text-destructive border-destructive/30',
  },
]

const SORT_OPTIONS = [
  { value: 'createdAt' as const, label: 'Created Date' },
  { value: 'name' as const, label: 'Name' },
  { value: 'lastLaunchedAt' as const, label: 'Last Used' },
  { value: 'status' as const, label: 'Status' },
]

const PLATFORM_LABELS: Record<string, string> = {
  amazon: 'Amazon',
  ebay: 'eBay',
  shopee: 'Shopee',
  lazada: 'Lazada',
  aliexpress: 'AliExpress',
  wish: 'Wish',
  etsy: 'Etsy',
  walmart: 'Walmart',
  mercadolibre: 'MercadoLibre',
  other: 'Other',
}

export function ProfileFilterBar({
  filter,
  sort,
  onSearchChange,
  onToggleStatus,
  onPlatformChange,
  onTagChange,
  onSortChange,
  onClear,
  hasActiveFilters,
  availableTags,
  availablePlatforms,
  resultCount,
  totalCount,
}: ProfileFilterBarProps) {
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [searchValue, setSearchValue] = useState(filter.searchQuery)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const platformRef = useRef<HTMLDivElement>(null)
  const tagRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      onSearchChange(searchValue)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchValue, onSearchChange])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        platformRef.current &&
        !platformRef.current.contains(e.target as Node)
      ) {
        setShowPlatformDropdown(false)
      }
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const togglePlatform = useCallback(
    (platform: string) => {
      const next = filter.platformFilter.includes(platform)
        ? filter.platformFilter.filter((p) => p !== platform)
        : [...filter.platformFilter, platform]
      onPlatformChange(next)
    },
    [filter.platformFilter, onPlatformChange],
  )

  const toggleTag = useCallback(
    (tag: string) => {
      const next = filter.tagFilter.includes(tag)
        ? filter.tagFilter.filter((t) => t !== tag)
        : [...filter.tagFilter, tag]
      onTagChange(next)
    },
    [filter.tagFilter, onTagChange],
  )

  return (
    <div className="mb-4 space-y-2">
      {/* Search + Sort row */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <SearchIcon className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-foreground/50" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search profiles..."
            className="w-full rounded border border-foreground/10 bg-background py-1.5 pr-8 pl-8 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                setSearchValue('')
                onSearchChange('')
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-foreground/50 hover:text-foreground"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1 text-xs">
          <ArrowUpDownIcon className="h-3.5 w-3.5 text-foreground/50" />
          <select
            value={sort.field}
            onChange={(e) =>
              onSortChange(e.target.value as ProfileSortState['field'])
            }
            className="rounded border border-foreground/10 bg-background px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-foreground/50">
            {sort.direction === 'asc' ? '\u2191' : '\u2193'}
          </span>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status chips */}
        {STATUS_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => onToggleStatus(opt.value)}
            className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
              filter.statusFilter.includes(opt.value)
                ? `${opt.color} font-medium`
                : 'border-foreground/10 bg-background text-foreground/50 hover:bg-foreground/5'
            }`}
          >
            {opt.label}
          </button>
        ))}

        {/* Platform dropdown */}
        {availablePlatforms.length > 0 && (
          <div className="relative" ref={platformRef}>
            <button
              type="button"
              onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                filter.platformFilter.length > 0
                  ? 'border-accent/30 bg-accent/10 font-medium text-accent'
                  : 'border-foreground/10 bg-background text-foreground/50 hover:bg-foreground/5'
              }`}
            >
              <FilterIcon className="h-3 w-3" />
              Platform
              {filter.platformFilter.length > 0 &&
                ` (${filter.platformFilter.length})`}
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {showPlatformDropdown && (
              <div className="absolute top-full left-0 z-10 mt-1 min-w-[160px] rounded border border-foreground/10 bg-background shadow-modal-small">
                {availablePlatforms.map((platform) => (
                  <label
                    key={platform}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-foreground/5"
                  >
                    <input
                      type="checkbox"
                      checked={filter.platformFilter.includes(platform)}
                      onChange={() => togglePlatform(platform)}
                      className="rounded"
                    />
                    {PLATFORM_LABELS[platform] || platform}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tag dropdown */}
        {availableTags.length > 0 && (
          <div className="relative" ref={tagRef}>
            <button
              type="button"
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                filter.tagFilter.length > 0
                  ? 'border-accent/30 bg-accent/10 font-medium text-accent'
                  : 'border-foreground/10 bg-background text-foreground/50 hover:bg-foreground/5'
              }`}
            >
              Tags
              {filter.tagFilter.length > 0 && ` (${filter.tagFilter.length})`}
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {showTagDropdown && (
              <div className="absolute top-full left-0 z-10 mt-1 max-h-48 min-w-[160px] overflow-y-auto rounded border border-foreground/10 bg-background shadow-modal-small">
                {availableTags.map((tag) => (
                  <label
                    key={tag}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-foreground/5"
                  >
                    <input
                      type="checkbox"
                      checked={filter.tagFilter.includes(tag)}
                      onChange={() => toggleTag(tag)}
                      className="rounded"
                    />
                    {tag}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Clear all + result count */}
        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                onClear()
                setSearchValue('')
              }}
              className="text-foreground/50 text-xs underline hover:text-destructive"
            >
              Clear all
            </button>
          )}
          {hasActiveFilters && (
            <span className="text-foreground/50 text-xs">
              {resultCount} of {totalCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
