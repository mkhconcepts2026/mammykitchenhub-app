export function generateEmployeeEmail(
  loginId: string
) {
  return `${loginId}@mammykitchenhub.com`;
}

export function generateUsername(
  firstName: string,
  lastName: string
) {
  const first = firstName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const last = lastName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  return `${first}.${last}`;
}