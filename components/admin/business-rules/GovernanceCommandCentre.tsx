export default function GovernanceCommandCentre() {

  const cards = [

    {
      title: "Active Rules",
      value: "--",
      icon: "🟢",
      color: "border-emerald-500",
      bg: "bg-emerald-50",
      note: "Currently governing MKH"
    },

    {
      title: "Pending Approval",
      value: "--",
      icon: "🟠",
      color: "border-orange-500",
      bg: "bg-orange-50",
      note: "Awaiting executive approval"
    },

    {
      title: "Scheduled Changes",
      value: "--",
      icon: "📅",
      color: "border-blue-500",
      bg: "bg-blue-50",
      note: "Future effective rules"
    },

    {
      title: "Expired Rules",
      value: "--",
      icon: "⚪",
      color: "border-slate-500",
      bg: "bg-slate-100",
      note: "Historical records"
    },

    {
      title: "Rule Conflicts",
      value: "--",
      icon: "🚨",
      color: "border-red-500",
      bg: "bg-red-50",
      note: "Requires attention"
    },

    {
      title: "Audit Events",
      value: "--",
      icon: "📖",
      color: "border-purple-500",
      bg: "bg-purple-50",
      note: "Recent governance activity"
    }

  ];

  return (

    <section className="space-y-6">

      <div>

        <h2 className="text-2xl font-bold text-slate-900">

          Governance Command Centre

        </h2>

        <p className="mt-2 text-slate-500">

          Central oversight of every active business rule,
          approval workflow and governance activity
          across the MKH ecosystem.

        </p>

      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">

        {cards.map((card) => (

          <div

            key={card.title}

            className={`rounded-2xl border-l-4 ${card.color} ${card.bg} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}

          >

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm font-semibold text-slate-500">

                  {card.title}

                </p>

                <h2 className="mt-3 text-3xl font-black text-slate-900">

                  {card.value}

                </h2>

                <p className="mt-3 text-xs text-slate-500">

                  {card.note}

                </p>

              </div>

              <div className="text-4xl">

                {card.icon}

              </div>

            </div>

          </div>

        ))}

      </div>

    </section>

  );

}