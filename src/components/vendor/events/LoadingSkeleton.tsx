import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <Card className="bg-surface-canvas border-folio-border-strong">
        <CardHeader className="pb-4">
          <div className="space-y-4">
            <div className="h-4 bg-folio-border-strong rounded w-32"></div>
            <div className="h-8 bg-folio-border-strong rounded w-96"></div>
            <div className="flex space-x-6">
              <div className="h-4 bg-folio-border-strong rounded w-48"></div>
              <div className="h-4 bg-folio-border-strong rounded w-32"></div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters Skeleton */}
      <Card className="bg-surface-canvas border-folio-border-strong">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-10 bg-folio-border-strong rounded w-48"></div>
            <div className="h-10 bg-folio-border-strong rounded w-32"></div>
            <div className="h-10 bg-folio-border-strong rounded w-24"></div>
            <div className="h-10 bg-folio-border-strong rounded w-20 ml-auto"></div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Strip Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-surface-canvas border-folio-border-strong">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-folio-border-strong rounded-full mr-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-folio-border-strong rounded w-20"></div>
                  <div className="h-6 bg-folio-border-strong rounded w-16"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-surface-canvas border-folio-border-strong">
            <CardHeader className="pb-4">
              <div className="space-y-2">
                <div className="h-5 bg-folio-border-strong rounded w-48"></div>
                <div className="h-4 bg-folio-border-strong rounded w-64"></div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[300px] bg-folio-border-strong rounded-lg"></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tables Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="bg-surface-canvas border-folio-border-strong">
            <CardHeader>
              <div className="h-5 bg-folio-border-strong rounded w-48"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="p-4 bg-surface-elevated rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-folio-border-strong rounded-full"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-folio-border-strong rounded w-32"></div>
                          <div className="h-3 bg-folio-border-strong rounded w-24"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-folio-border-strong rounded w-16"></div>
                        <div className="h-4 bg-folio-border-strong rounded w-20"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}









