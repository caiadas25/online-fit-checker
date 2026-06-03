export const ADMIN_SESSION_COOKIE = "fitmashr_admin";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_SUBJECT = "admin";

type AdminAuthConfig = {
  password: string;
  secret: string;
};

export function getAdminAuthConfig(): AdminAuthConfig | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return null;

  return {
    password,
    secret: process.env.ADMIN_AUTH_SECRET?.trim() || password,
  };
}

export function getAdminSessionMaxAge(): number {
  return SESSION_MAX_AGE_SECONDS;
}

export async function createAdminSessionToken(): Promise<string> {
  const config = getAdminAuthConfig();
  if (!config) throw new Error("Admin auth is not configured.");

  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${SESSION_SUBJECT}.${expiresAt}`;
  const signature = await sign(payload, config.secret);

  return `${payload}.${signature}`;
}

export async function isValidAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const config = getAdminAuthConfig();
  if (!config) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [subject, expiresAt, signature] = parts;
  if (subject !== SESSION_SUBJECT) return false;

  const expiresAtMs = Number(expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;

  const expected = await sign(`${subject}.${expiresAt}`, config.secret);
  return constantTimeEqual(signature, expected);
}

export async function isAdminCookieHeaderAuthenticated(
  cookieHeader: string | null,
): Promise<boolean> {
  return isValidAdminSessionToken(readCookie(cookieHeader, ADMIN_SESSION_COOKIE));
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

async function sign(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
