import { supabase } from "@/lib/supabase";
import {
  BusinessRule,
} from "@/types/businessRules";

/* =======================================================
   GET ALL BUSINESS RULES
======================================================= */

export async function getBusinessRules() {
  const { data, error } = await supabase
    .from("business_rules")
    .select("*")
    .order("category")
    .order("rule_name");

  if (error) throw error;

  return data as BusinessRule[];
}

/* =======================================================
   GET SINGLE RULE
======================================================= */

export async function getBusinessRule(
  ruleKey: string
) {
  const { data, error } = await supabase
    .from("business_rules")
    .select("*")
    .eq("rule_key", ruleKey)
    .single();

  if (error) throw error;

  return data as BusinessRule;
}

/* =======================================================
   UPDATE RULE
======================================================= */

export async function updateBusinessRule(
  id: string,
  value: number | string | boolean
) {
  const { error } = await supabase
    .from("business_rules")
    .update({
      value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

/* =======================================================
   RULE HISTORY
======================================================= */

export async function getRuleHistory() {
  const { data, error } = await supabase
    .from("business_rule_history")
    .select("*")
    .order("changed_at", {
      ascending: false,
    });

  if (error) throw error;

  return data;
}