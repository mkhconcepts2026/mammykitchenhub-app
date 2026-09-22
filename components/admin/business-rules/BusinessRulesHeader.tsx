export default function BusinessRulesHeader() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-700 bg-[#0F172A] p-8 shadow-2xl">

      {/* Background Glow */}

      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D4AF37]/20 blur-3xl" />

      <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

      <div className="relative">

        <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#F97316]">
          ADMINISTRATION
        </p>

        <h1 className="mt-3 text-4xl font-black text-white">
          Business Rules & Governance
        </h1>

        <p className="mt-4 max-w-4xl text-slate-300 leading-7">
          Configure and govern the financial, operational and commercial
          rules that power the MKH platform. Every commission, pricing
          policy, settlement rule and operational configuration is managed
          centrally to ensure consistency, auditability and enterprise
          control.
        </p>

      </div>

    </section>
  );
}