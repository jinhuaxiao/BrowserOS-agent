/**
 * RoleConfigPanel
 *
 * Shows the permission matrix as a reference table, displaying which
 * permissions are available for each role.
 */

import { Shield } from 'lucide-react'

const ROLES = ['owner', 'admin', 'manager', 'operator', 'viewer'] as const

const PERMISSIONS = [
  { label: 'Manage Members', roles: ['owner', 'admin'] },
  { label: 'Create/Delete Profiles', roles: ['owner', 'admin', 'manager'] },
  {
    label: 'Launch/Stop Profiles',
    roles: ['owner', 'admin', 'manager', 'operator'],
  },
  {
    label: 'View Profiles',
    roles: ['owner', 'admin', 'manager', 'operator', 'viewer'],
  },
  { label: 'Assign Profiles', roles: ['owner', 'admin', 'manager'] },
  { label: 'Manage Proxy Pool', roles: ['owner', 'admin'] },
  { label: 'View Activity Log', roles: ['owner', 'admin', 'manager'] },
  { label: 'Organization Settings', roles: ['owner'] },
] as const

export function RoleConfigPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-base">Roles & Permissions</h2>
        </div>
        <p className="mb-6 text-muted-foreground text-sm">
          Permissions are determined by the member's role. Managers can only
          operate within their assigned groups.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-foreground/5 border-b">
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground">
                  Permission
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role}
                    className="px-3 py-2 text-center font-medium text-muted-foreground capitalize"
                  >
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm) => (
                <tr key={perm.label} className="border-foreground/5 border-b">
                  <td className="py-2.5 pr-4">{perm.label}</td>
                  {ROLES.map((role) => (
                    <td key={role} className="px-3 py-2.5 text-center">
                      {(perm.roles as readonly string[]).includes(role) ? (
                        <span className="text-green-500">&#10003;</span>
                      ) : (
                        <span className="text-foreground/20">&#x2013;</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
