"use client";

export default function Header() {
  return (

    <header className="bg-white rounded-3xl shadow-sm px-8 py-6 flex justify-between items-center">

      <div>

        <h1 className="text-3xl font-bold">
          MKH Operations Command Center
        </h1>

        <p className="text-gray-500 mt-1">
          Territory Operations & Dispatch
        </p>

      </div>

      <div className="text-right">

        <div className="font-semibold">
          Operations Manager
        </div>

        <div className="text-sm text-gray-500">
          🟢 Live System
        </div>

      </div>

    </header>

  );
}