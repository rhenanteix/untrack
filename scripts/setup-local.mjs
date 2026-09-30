import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";

const path = ".env.local";
let content = existsSync(path)
  ? readFileSync(path, "utf8")
  : readFileSync(".env.example", "utf8");
function get(key) {
  const line = content
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${key}=`));
  return line?.slice(key.length + 1).replace(/^['"]|['"]$/g, "");
}
function fill(key, value) {
  const current = get(key);
  if (current && !current.includes("CHANGE_ME")) return;
  content = content
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(`${key}=`))
    .join("\n");
  content += `\n${key}="${value}"\n`;
}
fill("POSTGRES_PASSWORD", randomBytes(24).toString("hex"));
const password = encodeURIComponent(get("POSTGRES_PASSWORD"));
fill(
  "DATABASE_URL",
  `postgresql://arrume:${password}@localhost:55432/arrume_meu_link`,
);
fill(
  "TEST_DATABASE_URL",
  `postgresql://arrume:${password}@localhost:55432/arrume_meu_link_test`,
);
fill("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
fill("BETTER_AUTH_URL", "http://localhost:3000");
fill("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
writeFileSync(path, content, { mode: 0o600 });
chmodSync(path, 0o600);
console.log(
  "Configuração local pronta. Credenciais existentes foram preservadas.",
);
