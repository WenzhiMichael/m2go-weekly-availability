import { getAvailabilityD1 } from "./availability";

const COOKIE_NAME = "m2go_employee_access";
const SESSION_SECONDS = 90 * 24 * 60 * 60;
const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashEmployeeToken(token: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}

export function createEmployeeToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function cookieValue(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

export function createEmployeeSessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearEmployeeSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function getEmployeeSession(request: Request) {
  const token = cookieValue(request);
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const tokenHash = await hashEmployeeToken(token);
  return getAvailabilityD1().prepare(
    `SELECT e.id, e.display_name
     FROM employee_access_tokens t
     JOIN availability_employees e ON e.id = t.employee_id
     WHERE t.token_hash = ? AND e.active = 1`,
  ).bind(tokenHash).first<{ id: number; display_name: string }>();
}
