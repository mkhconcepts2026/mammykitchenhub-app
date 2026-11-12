export const ROLE_ROUTES: Record<string, string> = {

  managing_director: "/md",

  admin: "/admin",

  operations_manager: "/operations",

  relationship_manager: "/manager",

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