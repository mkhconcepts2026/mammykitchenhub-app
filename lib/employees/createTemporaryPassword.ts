export function createTemporaryPassword(length = 12): string {

  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "@#$%&*!?";

  const all =
    upper +
    lower +
    numbers +
    symbols;

  let password = "";

  // Ensure at least one of each character type

  password +=
    upper[Math.floor(Math.random() * upper.length)];

  password +=
    lower[Math.floor(Math.random() * lower.length)];

  password +=
    numbers[Math.floor(Math.random() * numbers.length)];

  password +=
    symbols[Math.floor(Math.random() * symbols.length)];

  while (password.length < length) {

    password +=
      all[Math.floor(Math.random() * all.length)];

  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");

}