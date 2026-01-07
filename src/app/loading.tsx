export default function Loading() {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin mx-auto mb-4"></div>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading...</h2>
        <p className="text-gray-600">Please wait while we load your content</p>
      </div>
    </div>
  );
} 