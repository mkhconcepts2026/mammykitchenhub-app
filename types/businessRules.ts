export interface BusinessRule {
  id: string;

  category:
    | "vendor"
    | "rider"
    | "platform"
    | "customer"
    | "territory"
    | "promotion"
    | "settlement";

  rule_key: string;

  rule_name: string;

  description?: string;

  value_type:
    | "percentage"
    | "currency"
    | "number"
    | "text"
    | "boolean";

  value: number | string | boolean;

  territory_id?: string | null;

  vendor_id?: string | null;

  rider_type?: string | null;

  effective_from: string;

  effective_to?: string | null;

  status:
    | "draft"
    | "pending"
    | "approved"
    | "active"
    | "expired";

  requires_approval: boolean;

  approved_by?: string | null;

  approved_at?: string | null;

  created_by: string;

  created_at: string;

  updated_at: string;
}

export interface RuleHistory {
  id: string;

  rule_id: string;

  changed_by: string;

  changed_at: string;

  previous_value: string;

  new_value: string;

  reason: string;

  approval_status:
    | "pending"
    | "approved"
    | "rejected";
}