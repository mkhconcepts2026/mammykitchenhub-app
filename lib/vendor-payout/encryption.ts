import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_ENV = "MKH_VENDOR_PAYOUT_ENCRYPTION_KEY";

function getEncryptionKey(): Buffer {
  const encoded = process.env[KEY_ENV];
  if (!encoded) {
    throw new Error(`${KEY_ENV} is not configured on the server.`);
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error(`${KEY_ENV} must be a Base64-encoded 32-byte key.`);
  }

  return key;
}

export function encryptVendorBankAccountNumber(value: string): string {
  const accountNumber = String(value ?? "").replace(/\s+/g, "");
  if (!/^\d{10}$/.test(accountNumber)) {
    throw new Error("A valid 10-digit bank account number is required.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(accountNumber, "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptVendorBankAccountNumber(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("The stored vendor bank-account ciphertext is missing.");
  }

  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = value.split(":");
  if (
    version !== "v1" ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra.length > 0
  ) {
    throw new Error("The stored vendor bank-account ciphertext has an unsupported format.");
  }

  const iv = Buffer.from(encodedIv, "base64");
  const tag = Buffer.from(encodedTag, "base64");
  const ciphertext = Buffer.from(encodedCiphertext, "base64");

  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("The stored vendor bank-account ciphertext is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  if (!/^\d{10}$/.test(decrypted)) {
    throw new Error("The decrypted vendor bank-account number is invalid.");
  }

  return decrypted;
}

export function isVendorBankAccountEncrypted(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return false;

  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");

  return iv.length === 12 && tag.length === 16 && ciphertext.length === 10;
}
