"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type RequestRow = {
  request_id: string;
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  employee_email: string | null;
  previous_employee_role: string | null;
  requested_job_role: string;
  requested_access_role: string | null;
  previous_access_role: string;
  reason: string;
  status: string;
  requested_at: string;
  requested_by: string;
  requester_name: string;
};

export default function HRRoleChangeRequestsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: effectiveRole, error: roleError } =
        await (supabase as any).rpc("current_effective_app_role");

      if (roleError) throw roleError;

      if (String(effectiveRole ?? "").toUpperCase() !== "HR") {
        router.replace("/login");
        return;
      }

      const { data, error: requestError } = await (supabase as any).rpc(
        "list_employee_role_change_requests",
        { p_status: "pending" }
      );

      if (requestError) throw requestError;

      setRequests(data ?? []);
    } catch (err: any) {
      setError(err?.message || "Unable to load pending role-change requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function processRequest(requestId: string, decision: "implement" | "reject") {
    setError("");
    setNotice("");

    const processingNotes = (notes[requestId] || "").trim();

    if (decision === "reject" && !processingNotes) {
      setError("Please enter a reason before rejecting a request.");
      return;
    }

    const confirmation =
      decision === "implement"
        ? "Implement this role and dashboard-access change?"
        : "Reject this role-change request?";

    if (!window.confirm(confirmation)) return;

    setWorkingId(requestId);

    try {
      const { error: processError } = await (supabase as any).rpc(
        "hr_process_employee_role_change",
        {
          p_request_id: requestId,
          p_decision: decision,
          p_notes: processingNotes || null,
        }
      );

      if (processError) throw processError;

      setNotice(
        decision === "implement"
          ? "The role-change request was implemented."
          : "The role-change request was rejected."
      );

      setNotes((current) => {
        const next = { ...current };
        delete next[requestId];
        return next;
      });

      await loadRequests();
    } catch (err: any) {
      setError(err?.message || "Unable to process this request.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link
          href="/hr"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600"
        >
          <ArrowLeft size={17} />
          Back to HR Dashboard
        </Link>

        <header className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
              HR Review
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Staff Role Change Requests
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Review requests submitted by Admin/COO, then implement or reject
              them with the appropriate notes.
            </p>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {notice && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {notice}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <Clock3 size={22} className="text-slate-500" />
            <div>
              <h2 className="text-lg font-bold">Pending requests</h2>
              <p className="text-sm text-slate-500">
                {requests.length} request{requests.length === 1 ? "" : "s"} awaiting HR processing
              </p>
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-sm text-slate-500">Loading pending requestsâ€¦</p>
          ) : requests.length === 0 ? (
            <p className="py-8 text-sm text-slate-500">
              There are no pending role-change requests.
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              {requests.map((request) => (
                <article key={request.request_id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{request.employee_name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {request.employee_number || request.employee_email || request.employee_id}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-800">
                      Pending
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Job position
                      </p>
                      <p className="mt-1 text-sm">
                        {request.previous_employee_role || "Unspecified"}
                        {" â†’ "}
                        <strong>{request.requested_job_role}</strong>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Dashboard access
                      </p>
                      <p className="mt-1 text-sm">
                        {request.previous_access_role}
                        {" â†’ "}
                        <strong>{request.requested_access_role || "Unspecified"}</strong>
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Reason for change
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {request.reason}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Requested by {request.requester_name} Â·{" "}
                    {new Date(request.requested_at).toLocaleString()}
                  </p>

                  <label className="mt-5 block text-sm font-semibold">
                    HR processing notes
                    <textarea
                      value={notes[request.request_id] || ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [request.request_id]: event.target.value,
                        }))
                      }
                      rows={2}
                      maxLength={2000}
                      placeholder="Required if rejecting; optional when implementing."
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={workingId !== null}
                      onClick={() => void processRequest(request.request_id, "implement")}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={17} />
                      {workingId === request.request_id ? "Processingâ€¦" : "Implement change"}
                    </button>

                    <button
                      type="button"
                      disabled={workingId !== null}
                      onClick={() => void processRequest(request.request_id, "reject")}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle size={17} />
                      Reject request
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-slate-500">
          HR processing changes the employee's job-role assignment and dashboard
          access assignment. The employee's personal profile role field is not
          rewritten by this workflow. Complete application-wide authorization
          migration and testing before using elevated access changes operationally.
        </p>
      </div>
    </main>
  );
}