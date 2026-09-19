#!/usr/bin/env python3
"""Local DM proxy for The Pale March. Serves the game and talks to xAI."""
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

def load_env():
    path = os.path.join(ROOT, ".env")
    if not os.path.isfile(path):
        return
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

load_env()
API = "https://api.x.ai/v1/chat/completions"
MODEL = os.environ.get("XAI_MODEL", "grok-4.6")


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        SimpleHTTPRequestHandler.end_headers(self)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/health":
            key = bool(os.environ.get("XAI_API_KEY"))
            self._json(200, {"ok": True, "dm": key})
            return
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/turn":
            self.send_error(404)
            return
        key = os.environ.get("XAI_API_KEY", "")
        if not key:
            self._json(503, {"error": "missing_key"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._json(400, {"error": "bad_json"})
            return
        messages = body.get("messages")
        if not isinstance(messages, list):
            self._json(400, {"error": "need_messages"})
            return
        payload = json.dumps({
            "model": MODEL,
            "temperature": 0.9,
            "messages": messages,
        }).encode("utf-8")
        req = urllib.request.Request(
            API,
            data=payload,
            headers={
                "Authorization": "Bearer " + key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")[:800]
            self._json(e.code, {"error": "upstream", "detail": err})
            return
        except Exception as e:
            self._json(502, {"error": "proxy", "detail": str(e)})
            return
        text = ""
        try:
            text = data["choices"][0]["message"]["content"]
        except Exception:
            self._json(502, {"error": "shape", "detail": data})
            return
        self._json(200, {"text": text})

    def _json(self, code, obj):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8777"))
    print("Pale March DM  http://127.0.0.1:%s" % port)
    print("xAI key:", "yes" if os.environ.get("XAI_API_KEY") else "MISSING — put it in .env")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
