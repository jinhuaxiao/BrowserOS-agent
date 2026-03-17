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
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  {
    value: 'idle' as const,
    label: 'Idle',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  {
    value: 'error' as const,
    label: 'Error',
    color: 'bg-red-100 text-red-700 border-red-200',
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
    <div className="space-y-2 mb-4">
      {/* Search + Sort row */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#565959]" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search profiles..."
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-[#D5D9D9] rounded bg-white focus:outline-none focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900]"
          />
          {searchValue && (
            <button
              onClick={() => {
                setSearchValue('')
                onSearchChange('')
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#565959] hover:text-[#0F1111]"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1 text-xs">
          <ArrowUpDownIcon className="w-3.5 h-3.5 text-[#565959]" />
          <select
            value={sort.field}
            onChange={(e) =>
              onSortChange(e.target.value as ProfileSortState['field'])
            }
            className="border border-[#D5D9D9] rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#FF9900]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-[#565959] text-[10px]">
            {sort.direction === 'asc' ? '\u2191' : '\u2193'}
          </span>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status chips */}
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onToggleStatus(opt.value)}
            className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
              filter.statusFilter.includes(opt.value)
                ? opt.color + ' font-medium'
                : 'bg-white text-[#565959] border-[#D5D9D9] hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}

        {/* Platform dropdown */}
        {availablePlatforms.length > 0 && (
          <div className="relative" ref={platformRef}>
            <button
              onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                filter.platformFilter.length > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200 font-medium'
                  : 'bg-white text-[#565959] border-[#D5D9D9] hover:bg-gray-50'
              }`}
            >
              <FilterIcon className="w-3 h-3" />
              Platform
              {filter.platformFilter.length > 0 &&
                ` (${filter.platformFilter.length})`}
              <ChevronDownIcon className="w-3 h-3" />
            </button>
            {showPlatformDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#D5D9D9] rounded shadow-lg z-10 min-w-[160px]">
                {availablePlatforms.map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs"
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
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                filter.tagFilter.length > 0
                  ? 'bg-purple-50 text-purple-700 border-purple-200 font-medium'
                  : 'bg-white text-[#565959] border-[#D5D9D9] hover:bg-gray-50'
              }`}
            >
              Tags
              {filter.tagFilter.length > 0 && ` (${filter.tagFilter.length})`}
              <ChevronDownIcon className="w-3 h-3" />
            </button>
            {showTagDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#D5D9D9] rounded shadow-lg z-10 min-w-[160px] max-h-48 overflow-y-auto">
                {availableTags.map((tag) => (
                  <label
                    key={tag}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs"
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
              onClick={() => {
                onClear()
                setSearchValue('')
              }}
              className="text-xs text-[#565959] hover:text-[#B12704] underline"
            >
              Clear all
            </button>
          )}
          {hasActiveFilters && (
            <span className="text-xs text-[#565959]">
              {resultCount} of {totalCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
