export async function generateEmployeeNumber() {
  const year = new Date().getFullYear();

  // Later we'll replace this with a database sequence.
  const random = Math.floor(100000 + Math.random() * 900000);

  return `MKH-${year}-${random}`;
}