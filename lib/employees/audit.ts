import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function writeAuditLog(
  action: string,
  employeeId: string,
  performedBy: string
) {
  await supabase.from("audit_logs").insert({
    action,
    employee_id: employeeId,
    performed_by: performedBy,
  });
}