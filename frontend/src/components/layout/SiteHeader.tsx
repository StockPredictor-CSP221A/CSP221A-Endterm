import { CommandMenu } from './CommandMenu'
import { MainNav } from './MainNav'
import { MobileNav } from './MobileNav'
import { UserMenu } from './UserMenu'
import { Wordmark } from './Wordmark'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 h-[70px] border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNav />
        <Wordmark />
        <div className="ml-6 hidden md:block">
          <MainNav />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <CommandMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
