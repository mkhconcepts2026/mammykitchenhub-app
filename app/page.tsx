export default function Home() {
  return (
    <main className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold text-orange-600 mb-4">
        Mammy Kitchen Hub
      </h1>

      <p className="text-lg text-gray-700 mb-8 text-center max-w-xl">
        Multi-vendor food delivery platform for customers, vendors, riders, and admins.
      </p>

      <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl text-lg font-medium transition">
        Order Food
      </button>
    </main>
  );
}