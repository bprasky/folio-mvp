export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Test Page Working! ✅
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          The app is running correctly
        </p>
        <div className="space-y-4">
          <a
            href="/auth/signup"
            className="block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
          >
            Go to Signup
          </a>
          <a
            href="/auth/signin"
            className="block bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700"
          >
            Go to Signin
          </a>
          <a
            href="/"
            className="block bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700"
          >
            Go to Home
          </a>
        </div>
      </div>
    </div>
  );
} 