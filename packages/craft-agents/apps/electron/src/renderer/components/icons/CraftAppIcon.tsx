import appIcon from '@/assets/app-icon.png'

interface CraftAppIconProps {
  className?: string
  size?: number
}

/**
 * CraftAppIcon - Displays the Craft Agents app icon
 */
export function CraftAppIcon({ className, size = 64 }: CraftAppIconProps) {
  return (
    <img
      src={appIcon}
      alt="Craft Agents"
      width={size}
      height={size}
      className={className}
    />
  )
}
