import { Skeleton } from '@/components/ui/skeleton'

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-64" />
    </div>
  )
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-52 rounded-xl" />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 rounded-lg" />
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <PageHeaderSkeleton />
      <CardGridSkeleton />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}
