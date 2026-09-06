import { next } from "@vercel/functions";

const COOKIE = "jv_gate";

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

async function tokenFor(password) {
  const data = new TextEncoder().encode("jv-gate-v1:" + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (
    path === "/login.html" ||
    path === "/api/login" ||
    path === "/favicon.ico" ||
    path === "/favicon.svg" ||
    path === "/favicon.png"
  ) {
    return next();
  }

  const password = process.env.SITE_PASSWORD || "";
  if (!password) {
    return new Response(
      "SITE_PASSWORD missing — set it in Vercel project env (Production) and redeploy.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const expected = await tokenFor(password);
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const got = cookies[COOKIE] || "";

  if (got && timingSafeEqual(got, expected)) {
    return next();
  }

  const login = new URL("/login.html", request.url);
  login.searchParams.set("next", path + url.search);
  return Response.redirect(login.toString(), 302);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
