import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <div className="container mx-auto px-4 py-16 flex-1">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              👟 SJSneakerz
            </h1>
          </div>

          {/* Main Action Cards */}
          <div className="flex flex-col gap-4 mb-8 max-w-md mx-auto">
            <Link
              href="/record-sale"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-center text-lg shadow-lg hover:shadow-xl"
            >
              📦 Sell
            </Link>

            <Link
              href="/inventory-summary"
              className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-center text-lg shadow-lg hover:shadow-xl"
            >
              📊 Inventory
            </Link>
            
            <Link
              href="/money-dashboard"
              className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-center text-lg shadow-lg hover:shadow-xl"
            >
              💰 Money
            </Link>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="pb-8 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>
          Built with ❤️ by Marc
        </p>
      </div>
    </div>
  );
}
