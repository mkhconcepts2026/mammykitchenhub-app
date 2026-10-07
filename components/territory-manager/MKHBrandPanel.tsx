import Image from "next/image";

export default function MKHBrandPanel() {
  return (
    <div className="border-b border-slate-800 bg-slate-950">
      <div className="px-6 py-5">

        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Mammy Kitchen Hub"
            width={72}
            height={72}
            priority
            className="rounded-2xl"
          />
        </div>

        {/* Brand */}

        <div className="mt-5 text-center">

          <h2 className="text-lg font-bold tracking-wide text-white">
            Mammy Kitchen Hub
          </h2>

          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-400">
            Territory Relationship Manager
          </p>

          <p className="mt-2 text-sm font-semibold text-amber-400">
            Operations Center
          </p>

        </div>

      </div>
    </div>
  );
}