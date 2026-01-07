
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="ml-64">
        {/* Header with Role-Based Actions Skeleton */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="mb-4 lg:mb-0">
                <div className="h-8 bg-gray-300 rounded-lg w-32 mb-2 animate-pulse"></div>
                <div className="h-5 bg-gray-300 rounded-lg w-80 animate-pulse"></div>
              </div>
              <div className="flex space-x-3">
                <div className="h-10 bg-gray-300 rounded-lg w-24 animate-pulse"></div>
                <div className="h-10 bg-gray-300 rounded-lg w-32 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Festival Carousel Skeleton */}
        <div className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-6">
              <div className="h-7 bg-gray-300 rounded-lg w-48 animate-pulse"></div>
              <div className="h-5 bg-gray-300 rounded-lg w-32 animate-pulse"></div>
            </div>
            
            {/* Festival Cards Skeleton */}
            <div className="flex overflow-x-auto space-x-6 pb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-80 bg-white rounded-xl border border-gray-200 shadow-sm animate-pulse">
                  {/* Festival Image */}
                  <div className="h-48 bg-gray-200 rounded-t-xl"></div>
                  
                  {/* Festival Content */}
                  <div className="p-6">
                    {/* Badges */}
                    <div className="flex gap-2 mb-3">
                      <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                      <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                    </div>
                    
                    {/* Title */}
                    <div className="h-6 bg-gray-200 rounded-lg mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded-lg w-3/4 mb-4"></div>
                    
                    {/* Date and Location */}
                    <div className="space-y-2 mb-4">
                      <div className="h-4 bg-gray-200 rounded-lg w-2/3"></div>
                      <div className="h-4 bg-gray-200 rounded-lg w-1/2"></div>
                    </div>
                    
                    {/* Event Count */}
                    <div className="h-4 bg-gray-200 rounded-lg w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Event Feed with Filters Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Sticky Filters Skeleton */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm mb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-4 space-y-4 lg:space-y-0">
                {/* Festival Filter */}
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded-lg w-16 mb-2 animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded-md w-64 animate-pulse"></div>
                </div>

                {/* Event Type Filter */}
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded-lg w-20 mb-2 animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded-md w-64 animate-pulse"></div>
                </div>

                {/* Sort Options */}
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded-lg w-12 mb-2 animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded-md w-64 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Fibonacci Events Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr" style={{ gridAutoFlow: 'dense' }}>
            {/* XL Tile (col-span-2 row-span-2) */}
            <div className="col-span-2 row-span-2 bg-white rounded-xl shadow-lg border border-gray-200 animate-pulse overflow-hidden">
              <div className="h-48 bg-gray-200"></div>
              <div className="p-6">
                {/* Badges */}
                <div className="flex gap-2 mb-3">
                  <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                  <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                </div>
                
                {/* Title */}
                <div className="h-7 bg-gray-200 rounded-lg mb-3"></div>
                <div className="h-5 bg-gray-200 rounded-lg w-3/4 mb-4"></div>
                
                {/* Description */}
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-gray-200 rounded-lg"></div>
                  <div className="h-4 bg-gray-200 rounded-lg w-2/3"></div>
                </div>
                
                {/* Meta Info */}
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-gray-200 rounded-lg w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded-lg w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
                </div>
                
                {/* RSVP Info */}
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded-lg w-20"></div>
                  <div className="h-4 bg-gray-200 rounded-lg w-16"></div>
                </div>
              </div>
            </div>

            {/* M Tiles (col-span-2 row-span-1) */}
            {[1, 2].map((i) => (
              <div key={`m-${i}`} className="col-span-2 row-span-1 bg-white rounded-xl shadow-lg border border-gray-200 animate-pulse overflow-hidden">
                <div className="h-32 bg-gray-200"></div>
                <div className="p-4">
                  {/* Badges */}
                  <div className="flex gap-2 mb-2">
                    <div className="h-5 bg-gray-200 rounded-full w-12"></div>
                  </div>
                  
                  {/* Title */}
                  <div className="h-5 bg-gray-200 rounded-lg mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded-lg w-2/3 mb-3"></div>
                  
                  {/* Meta Info */}
                  <div className="space-y-1 mb-3">
                    <div className="h-3 bg-gray-200 rounded-lg w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded-lg w-2/3"></div>
                  </div>
                  
                  {/* RSVP Info */}
                  <div className="flex justify-between items-center">
                    <div className="h-3 bg-gray-200 rounded-lg w-16"></div>
                    <div className="h-3 bg-gray-200 rounded-lg w-12"></div>
                  </div>
                </div>
              </div>
            ))}

            {/* S Tiles (col-span-1 row-span-1) */}
            {[1, 2, 3].map((i) => (
              <div key={`s-${i}`} className="col-span-1 row-span-1 bg-white rounded-xl shadow-lg border border-gray-200 animate-pulse overflow-hidden">
                <div className="h-24 bg-gray-200"></div>
                <div className="p-3">
                  {/* Badge */}
                  <div className="h-4 bg-gray-200 rounded-full w-10 mb-2"></div>
                  
                  {/* Title */}
                  <div className="h-4 bg-gray-200 rounded-lg mb-2"></div>
                  
                  {/* Meta Info */}
                  <div className="space-y-1 mb-2">
                    <div className="h-3 bg-gray-200 rounded-lg w-2/3"></div>
                    <div className="h-3 bg-gray-200 rounded-lg w-1/2"></div>
                  </div>
                  
                  {/* RSVP Info */}
                  <div className="flex justify-between items-center">
                    <div className="h-3 bg-gray-200 rounded-lg w-12"></div>
                    <div className="h-3 bg-gray-200 rounded-lg w-8"></div>
                  </div>
                </div>
              </div>
            ))}

            {/* Additional tiles to fill the pattern */}
            {/* Another M tile */}
            <div className="col-span-2 row-span-1 bg-white rounded-xl shadow-lg border border-gray-200 animate-pulse overflow-hidden">
              <div className="h-32 bg-gray-200"></div>
              <div className="p-4">
                <div className="flex gap-2 mb-2">
                  <div className="h-5 bg-gray-200 rounded-full w-12"></div>
                </div>
                <div className="h-5 bg-gray-200 rounded-lg mb-2"></div>
                <div className="h-4 bg-gray-200 rounded-lg w-2/3 mb-3"></div>
                <div className="space-y-1 mb-3">
                  <div className="h-3 bg-gray-200 rounded-lg w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded-lg w-2/3"></div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-3 bg-gray-200 rounded-lg w-16"></div>
                  <div className="h-3 bg-gray-200 rounded-lg w-12"></div>
                </div>
              </div>
            </div>

            {/* More S tiles */}
            {[4, 5, 6].map((i) => (
              <div key={`s-${i}`} className="col-span-1 row-span-1 bg-white rounded-xl shadow-lg border border-gray-200 animate-pulse overflow-hidden">
                <div className="h-24 bg-gray-200"></div>
                <div className="p-3">
                  <div className="h-4 bg-gray-200 rounded-full w-10 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded-lg mb-2"></div>
                  <div className="space-y-1 mb-2">
                    <div className="h-3 bg-gray-200 rounded-lg w-2/3"></div>
                    <div className="h-3 bg-gray-200 rounded-lg w-1/2"></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-3 bg-gray-200 rounded-lg w-12"></div>
                    <div className="h-3 bg-gray-200 rounded-lg w-8"></div>
                  </div>
                </div>
              </div>
            ))}

            {/* Final M tile */}
            <div className="col-span-2 row-span-1 bg-white rounded-xl shadow-lg border border-gray-200 animate-pulse overflow-hidden">
              <div className="h-32 bg-gray-200"></div>
              <div className="p-4">
                <div className="flex gap-2 mb-2">
                  <div className="h-5 bg-gray-200 rounded-full w-12"></div>
                </div>
                <div className="h-5 bg-gray-200 rounded-lg mb-2"></div>
                <div className="h-4 bg-gray-200 rounded-lg w-2/3 mb-3"></div>
                <div className="space-y-1 mb-3">
                  <div className="h-3 bg-gray-200 rounded-lg w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded-lg w-2/3"></div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-3 bg-gray-200 rounded-lg w-16"></div>
                  <div className="h-3 bg-gray-200 rounded-lg w-12"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 