import { pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pin = process.argv[2]?.trim();
const writeLocal = process.argv.includes("--write-local");
if (!/^\d{6}$/.test(pin ?? "")) {
  console.error("Usage: node scripts/create-manager-config.mjs <six-digit-pin> [--write-local]");
  process.exit(1);
}

const iterations = 210_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(pin, salt, iterations, 32, "sha256");
const base64url = (value) => value.toString("base64url");
const rawHash = `pbkdf2_sha256$${iterations}$${base64url(salt)}$${base64url(hash)}`;
const secret = base64url(randomBytes(32));

if (writeLocal) {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) throw new Error("LOCALAPPDATA is not available.");
  const directory = join(localAppData, "M2GO");
  const target = join(directory, "manager.env");
  mkdirSync(directory, { recursive: true });
  writeFileSync(target, `M2GO_MANAGER_PIN_HASH=${rawHash}\nM2GO_MANAGER_SESSION_SECRET=${secret}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`Manager configuration saved to ${target}`);
} else {
  console.log(`M2GO_MANAGER_PIN_HASH=${rawHash.replaceAll("$", "\\$")}`);
  console.log(`M2GO_MANAGER_SESSION_SECRET=${secret}`);
}
