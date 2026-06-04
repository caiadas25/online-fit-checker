export const ADMIN_SESSION_COOKIE = "fitmashr_admin";
export const TESTER_SESSION_COOKIE = "fitmashr_tester";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type AuthRole = "admin" | "tester";

const AUTH_SETTINGS: Record<
  AuthRole,
  {
    passwordEnv: string;
    secretEnv: string;
    subject: AuthRole;
  }
> = {
  admin: {
    passwordEnv: "ADMIN_PASSWORD",
    secretEnv: "ADMIN_AUTH_SECRET",
    subject: "admin",
  },
  tester: {
    passwordEnv: "TESTER_PASSWORD",
    secretEnv: "TESTER_AUTH_SECRET",
    subject: "tester",
  },
};

type AdminAuthConfig = {
  password: string;
  secret: string;
};

export function getAdminAuthConfig(): AdminAuthConfig | null {
  return getAuthConfig("admin");
}

export function getTesterAuthConfig(): AdminAuthConfig | null {
  return getAuthConfig("tester");
}

function getAuthConfig(role: AuthRole): AdminAuthConfig | null {
  const settings = AUTH_SETTINGS[role];
  const password = process.env[settings.passwordEnv]?.trim();
  if (!password) return null;

  return {
    password,
    secret: process.env[settings.secretEnv]?.trim() || password,
  };
}

export function getAdminSessionMaxAge(): number {
  return SESSION_MAX_AGE_SECONDS;
}

export async function createAdminSessionToken(): Promise<string> {
  return createSessionToken("admin");
}

export async function createTesterSessionToken(): Promise<string> {
  return createSessionToken("tester");
}

async function createSessionToken(role: AuthRole): Promise<string> {
  const config = getAuthConfig(role);
  if (!config) throw new Error(`${AUTH_SETTINGS[role].subject} auth is not configured.`);

  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${AUTH_SETTINGS[role].subject}.${expiresAt}`;
  const signature = await sign(payload, config.secret);

  return `${payload}.${signature}`;
}

export async function isValidAdminSessionToken(token: string | undefined): Promise<boolean> {
  return isValidSessionToken("admin", token);
}

export async function isValidTesterSessionToken(token: string | undefined): Promise<boolean> {
  return isValidSessionToken("tester", token);
}

async function isValidSessionToken(role: AuthRole, token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const config = getAuthConfig(role);
  if (!config) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [subject, expiresAt, signature] = parts;
  if (subject !== AUTH_SETTINGS[role].subject) return false;

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

export async function isTesterCookieHeaderAuthenticated(
  cookieHeader: string | null,
): Promise<boolean> {
  return (
    (await isAdminCookieHeaderAuthenticated(cookieHeader)) ||
    (await isValidTesterSessionToken(readCookie(cookieHeader, TESTER_SESSION_COOKIE)))
  );
}

export async function hasTesterSessionTokenAccess(
  adminToken: string | undefined,
  testerToken: string | undefined,
): Promise<boolean> {
  return (
    (await isValidAdminSessionToken(adminToken)) ||
    (await isValidTesterSessionToken(testerToken))
  );
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
