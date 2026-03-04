import type { FC } from 'react'
import { Outlet } from 'react-router'
import NovaLogo from '@/assets/nova_logo.png'

export const AuthLayout: FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex flex-col items-center">
        <img src={NovaLogo} alt="Nova Seller" className="size-16" />
      </div>
      <Outlet />
    </div>
  )
}
