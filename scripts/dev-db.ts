/**
 * Local development database helper.
 *
 * The platform is designed to run against a real PostgreSQL server (see
 * `docker-compose.yml`). For environments where Docker is unavailable this
 * script boots a real, npm-distributed PostgreSQL server (via
 * `embedded-postgres`) using the connection details in DATABASE_URL.
 *
 * Usage:
 *   npm run db:local          # initialise (once) and start
 *   npm run db:local:stop     # stop
 *   tsx scripts/dev-db.ts status
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

const require = createRequire(import.meta.url);

type ParsedUrl = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function parseDatabaseUrl(url: string): ParsedUrl {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username || "postgres"),
    password: decodeURIComponent(parsed.password || "postgres"),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres"),
  };
}

function resolveBinDir(): string {
  const candidates: string[] = [];
  try {
    // Resolve the package entry point, then walk up to its package root.
    let dir = path.dirname(require.resolve("embedded-postgres"));
    for (let i = 0; i < 6; i += 1) {
      candidates.push(path.join(dir, "node_modules", "@embedded-postgres", `linux-${process.arch}`, "native", "bin"));
      candidates.push(path.join(dir, "@embedded-postgres", `linux-${process.arch}`, "native", "bin"));
      candidates.push(path.join(dir, "native", "bin"));
      dir = path.dirname(dir);
    }
  } catch {
    /* fall through */
  }
  candidates.push(
    path.join(process.cwd(), "node_modules", "@embedded-postgres", `linux-${process.arch}`, "native", "bin"),
  );
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "postgres"))) return candidate;
  }
  throw new Error(
    "embedded-postgres binaries not found. Run `npm install` (it is an optional dependency) or start PostgreSQL via Docker instead.",
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(700);
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    socket.on("timeout", () => done(false));
  });
}

function run(bin: string, args: string[], env: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env: { ...process.env, ...env } as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => (out += String(d)));
    child.stderr?.on("data", (d) => (err += String(d)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out + err) : reject(new Error(`${path.basename(bin)} failed (${code}): ${err || out}`))));
  });
}

async function main() {
  const command = process.argv[2] ?? "start";
  const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/him?schema=public";
  const { host, port, user, password, database } = parseDatabaseUrl(url);
  const binDir = resolveBinDir();
  const dataDir = path.resolve(process.cwd(), ".pgdata");
  const logFile = path.resolve(process.cwd(), ".pgdata", "server.log");

  if (command === "status") {
    const open = await isPortOpen(host, port);
    console.log(open ? `PostgreSQL is accepting connections on ${host}:${port}` : `No server listening on ${host}:${port}`);
    return;
  }

  if (command === "stop") {
    if (existsSync(dataDir)) {
      try {
        await run(path.join(binDir, "pg_ctl"), ["-D", dataDir, "-m", "fast", "stop"]);
        console.log("Development database stopped.");
      } catch (error) {
        console.log(`Stop skipped: ${(error as Error).message.split("\n")[0]}`);
      }
    }
    return;
  }

  if (await isPortOpen(host, port)) {
    console.log(`PostgreSQL already listening on ${host}:${port} - nothing to do.`);
    return;
  }

  mkdirSync(dataDir, { recursive: true });
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log(`Initialising PostgreSQL cluster at ${dataDir} ...`);
    const { writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const pwFile = path.join(tmpdir(), `him-pg-init-${process.pid}`);
    writeFileSync(pwFile, password, { mode: 0o600 });
    await run(path.join(binDir, "initdb"), [
      "-D",
      dataDir,
      "-U",
      user,
      `--pwfile=${pwFile}`,
      "--auth=scram-sha-256",
      "--auth-host=scram-sha-256",
      "--auth-local=trust",
      "--encoding=UTF8",
      "--locale=C",
    ]);
    console.log("Cluster initialised.");
  }

  console.log(`Starting PostgreSQL on ${host}:${port} ...`);
  const { openSync } = await import("node:fs");
  const logFd = openSync(logFile, "a");
  const server = spawn(
    path.join(binDir, "postgres"),
    ["-D", dataDir, "-h", host, "-p", String(port), "-k", path.resolve(dataDir)],
    { detached: true, stdio: ["ignore", logFd, logFd] },
  );
  server.unref();

  for (let i = 0; i < 60; i += 1) {
    if (await isPortOpen(host, port)) break;
    await sleep(500);
  }

  if (!(await isPortOpen(host, port))) {
    throw new Error(`PostgreSQL did not start. Check ${logFile}`);
  }

  console.log(`PostgreSQL is ready on ${host}:${port}. Database "${database}" will be created by \`prisma migrate dev\`.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
