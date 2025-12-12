import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/upload" className="block">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <h2 className="text-xl font-semibold mb-2">Upload Route</h2>
              <p className="text-gray-600">Add new climbing routes with GPS photos</p>
            </div>
          </Link>

          <Link href="/map" className="block">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <h2 className="text-xl font-semibold mb-2">Explore Map</h2>
              <p className="text-gray-600">Browse climbing locations on satellite view</p>
            </div>
          </Link>

          <Link href="/logbook" className="block">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <h2 className="text-xl font-semibold mb-2">My Logbook</h2>
              <p className="text-gray-600">Track your climbing adventures</p>
            </div>
          </Link>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600">
            Join the Guernsey climbing community. Upload routes, explore new spots, and log your sends!
          </p>
        </div>
      </main>
    </div>
  )
}
