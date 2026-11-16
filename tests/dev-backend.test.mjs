import assert from "node:assert/strict";
import test from "node:test";
import { prepareBackend, selectBackendPython } from "../scripts/dev-backend.mjs";

const windows = { root: "C:\\Project With Spaces", platform: "win32", env: {} };
const projectPython = "C:\\Project With Spaces\\threatlens\\.venv\\Scripts\\python.exe";

test("Windows development uses the project environment instead of global Python", () => {
  assert.equal(
    selectBackendPython({ ...windows, fileExists: (file) => file === projectPython }).command,
    projectPython,
  );
});

test("an explicitly activated environment retains priority", () => {
  const command = "C:\\Custom Python\\Scripts\\python.exe";
  assert.equal(
    selectBackendPython({
      ...windows,
      env: { VIRTUAL_ENV: "C:\\Custom Python" },
      fileExists: (file) => [command, projectPython].includes(file),
    }).command,
    command,
  );
});

test("Unix environments use bin/python; root environment and PATH remain supported", () => {
  const options = { root: "/project", platform: "linux", env: {} };
  assert.equal(
    selectBackendPython({ ...options, fileExists: (file) => file === "/project/.venv/bin/python" })
      .command,
    "/project/.venv/bin/python",
  );
  assert.equal(selectBackendPython({ ...options, fileExists: () => false }).command, "python3");
});

test("readiness probes preserve the existing Uvicorn interface without shell interpolation", () => {
  const backend = prepareBackend({
    ...windows,
    fileExists: (file) => file === projectPython,
    inspect(command, args, options) {
      assert.equal(command, projectPython);
      assert.equal(args[0], "-I");
      assert.equal(options.cwd, windows.root);
      assert.equal(options.timeout, 15000);
      assert.equal(options.shell, undefined);
      return { status: 0, stdout: JSON.stringify({ status: "ready", version: [3, 12, 14] }) };
    },
  });
  assert.equal(backend.version, "3.12.14");
  assert.deepEqual(backend.args, [
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
  ]);
});

for (const [status, message] of [
  ["unsupported", /not Python 3\.11 or 3\.12/],
  ["missing_dependencies", /missing backend dependencies/],
  ["application_control", /do not disable security protections/],
  ["import_failed", /readiness check/],
]) {
  test(`${status} stops before launch with actionable, sanitized feedback`, () => {
    assert.throws(
      () =>
        prepareBackend({
          ...windows,
          fileExists: () => false,
          inspect: () => ({
            status: 1,
            stdout: JSON.stringify({ status, version: [3, 14, 0] }),
            stderr: "synthetic-private-diagnostic-must-not-appear",
          }),
        }),
      (error) => message.test(error.message) && !error.message.includes("synthetic-private"),
    );
  });
}

test("missing interpreters and malformed probe output fail without echoing diagnostics", () => {
  for (const result of [
    { error: new Error("synthetic-private"), status: null },
    { status: 1, stdout: "synthetic-private" },
  ]) {
    assert.throws(
      () => prepareBackend({ ...windows, fileExists: () => false, inspect: () => result }),
      (error) =>
        /readiness check/.test(error.message) && !error.message.includes("synthetic-private"),
    );
  }
});
