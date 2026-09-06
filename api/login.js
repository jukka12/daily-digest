import { createHash } from "node:crypto";

function tokenFor(password) {
  return createHash("sha256").update("jv-gate-v1:" + password, "utf8").digest("hex");
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const expected = process.env.SITE_PASSWORD || "";
  if (!expected) {
    res.statusCode = 503;
    res.end("SITE_PASSWORD not configured");
    return;
  }

  const raw = await parseBody(req);
  const params = new URLSearchParams(raw);
  const password = params.get("password") || "";
  const nextPath = params.get("next") || "/";
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  if (password !== expected) {
    res.statusCode = 302;
    res.setHeader("Location", "/login.html?error=1&next=" + encodeURIComponent(safeNext));
    res.end();
    return;
  }

  const token = tokenFor(expected);
  const cookie = [
    "jv_gate=" + token,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=2592000",
  ].join("; ");
  res.statusCode = 302;
  res.setHeader("Set-Cookie", cookie);
  res.setHeader("Location", safeNext);
  res.end();
}
