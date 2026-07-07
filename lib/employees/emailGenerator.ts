export function generateEmployeeEmail(
  firstName: string,
  lastName: string
) {
  const first = firstName.trim().toLowerCase();
  const last = lastName.trim().toLowerCase();

  return `${first}.${last}@mammykitchenhub.com`;
}

export function generateUsername(
  firstName: string,
  lastName: string
) {
  return `${firstName.trim().toLowerCase()}.${lastName.trim().toLowerCase()}`;
}