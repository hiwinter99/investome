import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(process.env.INVESTOME_BACKEND_DIR || resolve(root, "../investome-backend"));
const windows = process.platform === "win32";
const wrapper = resolve(backend, windows ? "mvnw.cmd" : "mvnw");
if (!existsSync(wrapper) || !existsSync(resolve(backend, "pom.xml"))) {
  console.error("investome-backend를 investome 옆에 clone하거나 INVESTOME_BACKEND_DIR을 지정하세요.");
  process.exit(1);
}

const env = { ...process.env };
const envFile = resolve(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(KIS_APP_KEY|KIS_APP_SECRET)\s*=\s*(.*?)\s*$/);
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const args = ["spring-boot:run"];
if (process.argv.includes("--preview")) {
  const previewPort = Number(env.PREVIEW_PORT || 18081);
  if (!Number.isInteger(previewPort) || previewPort < 1024 || previewPort > 65535) {
    console.error("PREVIEW_PORT는 1024~65535 사이의 정수여야 합니다.");
    process.exit(1);
  }
  // Each process uses its own H2 file so two previews do not lock the same DB.
  const local = resolve(root, previewPort === 18081 ? "work/local-preview" : `work/local-preview-${previewPort}`);
  mkdirSync(local, { recursive: true });
  const keyFile = resolve(local, "jwt.key");
  if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32).toString("hex"), { mode: 0o600 });
  env.SPRING_APPLICATION_JSON = JSON.stringify({
    server: { address: "127.0.0.1", port: previewPort },
    spring: {
      datasource: { url: `jdbc:h2:file:${local.replaceAll("\\", "/")}/paper-preview;MODE=PostgreSQL;DB_CLOSE_ON_EXIT=FALSE`, "driver-class-name": "org.h2.Driver", username: "sa", password: "" },
      jpa: { hibernate: { "ddl-auto": "update" }, properties: { hibernate: { dialect: "org.hibernate.dialect.H2Dialect" } } },
    },
    jwt: { secret: readFileSync(keyFile, "utf8").trim() },
    turnstile: { "secret-key": "" },
  });
  args.push("-Dspring-boot.run.useTestClasspath=true");
  console.log(`로컬 미리보기: http://127.0.0.1:${previewPort} (별도 H2 DB)`);
}
console.log(`백엔드 소스: ${backend}`);
const child = spawn(windows ? "cmd.exe" : "sh", windows ? ["/d", "/s", "/c", "mvnw.cmd", ...args] : [wrapper, ...args], {
  cwd: backend, env, stdio: "inherit",
});
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
