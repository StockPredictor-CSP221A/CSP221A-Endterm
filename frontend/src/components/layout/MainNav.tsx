import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

import { NAV_ITEMS } from './nav'

export function MainNav() {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
              isActive && 'text-brand hover:text-brand',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
