import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function databasePath(): string {
  const filename = process.env.DATABASE_PATH ?? "./data/ottodot.sqlite";
  if (!filename.trim() || filename === ":memory:")
    throw new Error("DATABASE_PATH must be a non-empty persistent file path");
  const absolute = resolve(filename);
  mkdirSync(dirname(absolute), { recursive: true });
  return absolute;
}

export function serverAddress(): { hostname: string; port: number } {
  const hostname = process.env.HOST ?? "127.0.0.1";
  const value = process.env.PORT ?? "3000";
  const port = Number(value);
  if (
    !hostname.trim() ||
    !/^\d+$/.test(value) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      "HOST must be non-empty and PORT must be an integer between 1 and 65535",
    );
  }
  return { hostname, port };
}
