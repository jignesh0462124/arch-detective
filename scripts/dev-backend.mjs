import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

// Probe imports without loading application settings or printing credentials.
const readinessProbe = `
import json, sys
result = {"version": list(sys.version_info[:3]), "status": "ready"}
if sys.version_info[:2] not in ((3, 11), (3, 12)):
    result["status"] = "unsupported"
else:
    try:
        import uvicorn, asyncpg
    except ModuleNotFoundError:
        result["status"] = "missing_dependencies"
    except (ImportError, OSError) as exc:
        result["status"] = "application_control" if "Application Control policy" in str(exc) else "import_failed"
print(json.dumps(result))
sys.exit(0 if result["status"] == "ready" else 1)
`;

export function selectBackendPython({
  root = projectRoot,
  env = process.env,
  platform = process.platform,
  fileExists = existsSync,
} = {}) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const executable = (directory) =>
    paths.join(
      directory,
      ...(platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"]),
    );
  const candidates = [
    ...(env.VIRTUAL_ENV
      ? [{ command: executable(env.VIRTUAL_ENV), label: "activated virtual environment" }]
      : []),
    { command: executable(paths.join(root, "threatlens", ".venv")), label: "threatlens/.venv" },
    { command: executable(paths.join(root, ".venv")), label: ".venv" },
  ];
  return (
    candidates.find((candidate) => fileExists(candidate.command)) || {
      command: platform === "win32" ? "python" : "python3",
      label: "PATH interpreter",
    }
  );
}

export function prepareBackend(options = {}) {
  const root = options.root || projectRoot;
  const runtime = selectBackendPython({ ...options, root });
  const result = (options.inspect || spawnSync)(runtime.command, ["-I", "-c", readinessProbe], {
    cwd: root,
    env: options.env || process.env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 65536,
  });
  let probe;
  try {
    probe = JSON.parse((result.stdout || "").trim().split(/\r?\n/).at(-1));
  } catch {
    // A failed native import can contain system details; do not echo its output.
  }
  const instructions = "See threatlens/INSTALLATION.md for the Python 3.12 environment setup.";
  if (probe?.status === "unsupported")
    throw new Error(`The ${runtime.label} is not Python 3.11 or 3.12. ${instructions}`);
  if (probe?.status === "missing_dependencies")
    throw new Error(`The ${runtime.label} is missing backend dependencies. ${instructions}`);
  if (probe?.status === "application_control")
    throw new Error(
      `Windows Application Control blocked a native module in the ${runtime.label}. Use an approved Python environment or contact your administrator; do not disable security protections. ${instructions}`,
    );
  if (
    result.error ||
    result.status !== 0 ||
    probe?.status !== "ready" ||
    !Array.isArray(probe.version)
  )
    throw new Error(
      `The ${runtime.label} could not pass the backend readiness check. ${instructions}`,
    );

  return {
    ...runtime,
    version: probe.version.join("."),
    cwd: root,
    args: [
      "-m",
      "uvicorn",
      "app.main:app",
      "--app-dir",
      "threatlens",
      "--env-file",
      "threatlens/.env",
      "--host",
      "127.0.0.1",
      "--port",
      "8000",
      "--reload",
    ],
  };
}

function main() {
  let backend;
  try {
    backend = prepareBackend();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  console.info(`Using Python ${backend.version} from ${backend.label}.`);
  const child = spawn(backend.command, backend.args, {
    cwd: backend.cwd,
    stdio: "inherit",
    windowsHide: true,
    shell: false,
  });
  child.once("error", () => {
    console.error("Unable to start the backend. See threatlens/INSTALLATION.md.");
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main();
