// Production workerd refuses PBKDF2 iteration counts above 100,000; never raise this.
const ITERATIONS = 100_000;
const ALGORITHM = "pbkdf2_sha256";

/** `pbkdf2_sha256$<iterations>$<salt base64>$<key base64>` for a fresh random salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(password, salt, ITERATIONS);
  return [ALGORITHM, ITERATIONS, toBase64(salt), toBase64(key)].join("$");
}

/** Constant-time comparison of `password` against a hash from `hashPassword`. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterations, salt, key] = stored.split("$");
  if (algorithm !== ALGORITHM || !iterations || !salt || !key) return false;
  const expected = fromBase64(key);
  const actual = await derive(password, fromBase64(salt), Number(iterations));
  return actual.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(actual, expected);
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256);
  return new Uint8Array(bits);
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}
