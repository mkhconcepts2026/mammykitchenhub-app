export const ROLE_ROUTES: Record<string, string> = {

  managing_director: "/md",

  admin: "/admin",

  operations_manager: "/operations",

  relationship_manager: "/manager",

  zonal_manager: "/zonal-manager-dashboard",
  "zonal manager": "/zonal-manager-dashboard",
  zone_manager: "/zonal-manager-dashboard",
  "zone manager": "/zonal-manager-dashboard",
  zm: "/zonal-manager-dashboard",
  vendor_hub_agent: "/vendor-hub-agent-dashboard",
  "vendor hub agent": "/vendor-hub-agent-dashboard",
  vha: "/vendor-hub-agent-dashboard",

  finance: "/finance",

  hr: "/hr",

  customer_support: "/support",

};

export const EMPLOYEE_ROLES = [

  "managing_director",

  "admin",

  "operations_manager",

  "relationship_manager",

  "finance",

  "hr",

  "customer_support",

] as const;

export const DEPARTMENTS = [

  "Executive",

  "Administration",

  "Operations",

  "Finance",

  "Human Resources",

  "Customer Support",

] as const;

export const EMPLOYMENT_TYPES = [

  "Full Time",

  "Part Time",

  "Contract",

  "Intern",

] as const;