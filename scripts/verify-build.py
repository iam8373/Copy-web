#!/usr/bin/env python3
"""
Asserts properties of a NORMAL production build (no e2e flags). Used by CI
through scripts/verify-build.sh; self-tested by scripts/verify-build.selftest.sh.

    usage: python3 scripts/verify-build.py [distDir]   (default .next)

On failure every finding is printed as

    <file> :: <pattern name> :: …<masked context>…

Secret-shaped values are never printed: the match and anything secret-shaped
in its context are replaced by <masked:NAME len=N>. Variable NAMES (which are
not secrets) are printed so the source can be found.
"""
import base64
import json
import os
import re
import sys

DIST = sys.argv[1] if len(sys.argv) > 1 else ".next"
if not os.path.isdir(DIST):
    print(f"verify-build: {DIST} not found; run the build first", file=sys.stderr)
    sys.exit(2)

TEXT_EXT = (".js", ".html", ".rsc", ".css", ".json", ".body", ".txt", ".xml", ".meta")

# Secret SHAPES: always masked in output.
SECRET_SHAPES = {
    "supabase-secret-key": rb"sb_secret_[A-Za-z0-9_-]{6,}",
    "google-api-key": rb"AIza[0-9A-Za-z_-]{35}",
    "openai-style-key": rb"sk-[A-Za-z0-9_-]{20,}",
    "turnstile-secret": rb"0x4[A-Za-z0-9_-]{30,}",
}
JWT = re.compile(rb"eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}")
MASK_ANY = re.compile(b"|".join(SECRET_SHAPES.values()) + rb"|" + JWT.pattern)


def files(root, under=None):
    base = os.path.join(root, under) if under else root
    for d, _, fs in os.walk(base):
        if os.sep + "cache" in d.replace(root, "", 1):
            continue
        for f in fs:
            if f.endswith(TEXT_EXT):
                yield os.path.join(d, f)


def read(path):
    try:
        with open(path, "rb") as fh:
            return fh.read()
    except OSError:
        return b""


def masked(data, m, secret):
    a, b = max(0, m.start() - 40), min(len(data), m.end() + 40)
    before, hit, after = data[a:m.start()], data[m.start():m.end()], data[m.end():b]
    sub = lambda s: MASK_ANY.sub(lambda x: f"<masked len={len(x.group())}>".encode(), s)
    shown = f"<masked:{secret} len={len(hit)}>".encode() if secret else hit
    text = (sub(before) + shown + sub(after)).decode("utf8", "replace")
    return "…" + re.sub(r"\s+", " ", text) + "…"


def rel(path):
    return os.path.relpath(path, os.path.dirname(os.path.abspath(DIST)) or ".")


failures = 0


def report(title_ok, title_bad, findings):
    """findings: list of (path, pattern_name, context)."""
    global failures
    if not findings:
        print(f"✓ {title_ok}")
        return
    failures += 1
    print(f"✗ {title_bad}:")
    shown = 0
    for path, name, ctx in findings:
        if shown >= 40:
            print(f"    … and {len(findings) - shown} more")
            break
        print(f"    {rel(path)} :: {name} :: {ctx}")
        shown += 1


def scan(paths, patterns, secret_names=()):
    out = []
    for p in paths:
        data = read(p)
        for name, pat in patterns.items():
            for i, m in enumerate(re.finditer(pat, data)):
                if i >= 3:
                    break
                out.append((p, name, masked(data, m, name if name in secret_names else None)))
    return out


ALL = list(files(DIST))
STATIC = list(files(DIST, "static"))
SERVER = list(files(DIST, "server"))

# 1. Test-only error trigger compiled out (Phase 4, D-012).
report(
    "test-only error trigger compiled out",
    "test-only /e2e-error code is present in the build",
    scan(ALL, {"e2e-error-marker": rb"bp-e2e-throw|E2E_SECRET_INTERNAL_DETAIL"}),
)

# 1b. Test-only UI gallery and the test-only routes do not exist at all.
#     Markers are the gallery's own test ids. "About the order book" used to be
#     a marker too; it is a PROVEN FALSE POSITIVE since 5d2c1b7, where it
#     became a real user-facing string (i18n market.aboutOrderBook, the order
#     book tooltip), so it is no longer used here.
#     Route paths are checked in every output file (route manifests, robots,
#     sitemap, middleware): the pages exist only with the e2e build flags.
report(
    "test-only UI gallery and test-only routes absent",
    "test-only /e2e-ui gallery or test-only routes present in the build",
    scan(ALL, {
        "e2e-ui-gallery-marker": rb"\bui-gallery\b|\bcaptcha-pass\b",
        "test-only-route": rb"/e2e-(?:ui|error)\b",
    }),
)

# 2. AI provider containment (D-014, D-018, D-031).
#    - OpenAI: never anywhere (Gemini is the only provider).
#    - Gemini integration identifiers (endpoint, auth header, env var names):
#      never in browser bundles; in server output only in admin route bundles
#      or in server chunks that ONLY admin pages/routes load.
#    The words "OpenAI" / "Google Gemini" are market CONTENT (AI category
#    chips, catalogue) and are deliberately not patterns.
OPENAI = {"openai-endpoint": rb"api\.openai\.com", "openai-key-name": rb"\bOPENAI_[A-Z_]*KEY\b"}
GEMINI = {
    "gemini-endpoint": rb"generativelanguage\.googleapis\.com",
    "gemini-auth-header": rb"x-goog-api-key",
    "gemini-env-name": rb"\bGEMINI_(?:API_KEY|MODEL|BASE_URL)\b",
}
findings = scan(ALL, OPENAI) + scan(STATIC, GEMINI)

server_app = os.path.join(DIST, "server", "app")
admin_dir = os.path.join(server_app, "admin") + os.sep
chunks_dir = os.path.join(DIST, "server", "chunks") + os.sep
entry_files = [p for p in files(DIST, os.path.join("server", "app")) if os.path.basename(p) in ("page.js", "route.js")]
CHUNK_LIST = re.compile(rb"\(0,\[([0-9,]+)\]")


def loaders(chunk_id):
    out = []
    for e in entry_files:
        for m in CHUNK_LIST.finditer(read(e)):
            if chunk_id in m.group(1).split(b","):
                out.append(e)
                break
    return out


for p in SERVER:
    hits = scan([p], GEMINI)
    if not hits:
        continue
    if p.startswith(admin_dir):
        continue  # inlined into an admin route bundle
    if p.startswith(chunks_dir) and re.fullmatch(r"\d+\.js", os.path.basename(p)):
        users = loaders(os.path.basename(p)[:-3].encode())
        public = [u for u in users if not u.startswith(admin_dir)]
        if users and not public:
            continue  # loaded by admin routes only
        for u in public[:3]:
            hits.append((p, "provider-chunk-loaded-by-non-admin-route", f"loaded by {rel(u)}"))
        if not users:
            hits.append((p, "provider-chunk-without-admin-loader", "no admin page or route loads this chunk"))
    findings += hits
report(
    "no OpenAI references; Gemini integration only in admin-only server code",
    "AI provider (OpenAI/Gemini) references outside admin-only server code",
    findings,
)

# 2b. No server secret reaches the browser (backend B2). Secret shapes are
#     masked; secret NAMES are shown. A JWT is allowed only if its payload
#     role is "anon" (a legacy publishable key).
SECRET_NAMES = {
    "secret-name": rb"\b(?:SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|AUTH_COOKIE_SECRET|TURNSTILE_SECRET[A-Z_]*|CRON_SECRET|GEMINI_API_KEY|OPENAI_API_KEY)\b",
    "service-role-name": rb"\bservice_role\b",
}
findings = scan(STATIC, SECRET_SHAPES, secret_names=SECRET_SHAPES.keys()) + scan(STATIC, SECRET_NAMES)
for p in STATIC:
    data = read(p)
    for m in JWT.finditer(data):
        seg = m.group(1) + b"=" * (-len(m.group(1)) % 4)
        try:
            role = json.loads(base64.urlsafe_b64decode(seg)).get("role")
        except Exception:
            role = None
        if role != "anon":
            findings.append((p, f"jwt-role-{role or 'unknown'}", masked(data, m, "jwt")))
report(
    "no secrets, secret names or non-anon JWTs in browser bundles",
    "secret-shaped strings or secret names in browser bundles",
    findings,
)

# 2c. The static market catalogue is seed-only (B3).
report(
    "static market catalogue not in browser bundles",
    "static market catalogue bundled into the app",
    scan(STATIC, {"catalogue-text": rb"holds the office of Prime Minister of India continuously"}),
)

# 3. No Google Fonts in app output (Phase 2, D-010). Next's framework chunks
#    carry an inert GOOGLE_FONT_PROVIDER constant, so only pages and CSS count.
fonts_scope = list(files(DIST, os.path.join("server", "app"))) + list(files(DIST, os.path.join("static", "css")))
report(
    "no Google Fonts URLs in pages or CSS",
    "Google Fonts URLs in app output",
    scan(fonts_scope, {"google-fonts-url": rb"fonts\.(?:googleapis|gstatic)\.com"}),
)

sys.exit(1 if failures else 0)
