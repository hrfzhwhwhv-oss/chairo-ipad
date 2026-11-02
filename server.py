#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os
import socket
import threading
import time
import webbrowser

PORT = 8765
HOST = "0.0.0.0"
ROOT = os.path.dirname(os.path.abspath(__file__))

state_lock = threading.Condition()
state = {
    "command": None,
    "version": 0,
    "clients": {}
}

def now_ms():
    return int(time.time() * 1000)

def local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"
    finally:
        s.close()

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        # Keep terminal output quiet except for important server messages.
        pass

    def send_json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/time":
            self.send_json({"serverNow": now_ms()})
            return

        if parsed.path == "/api/status":
            with state_lock:
                cutoff = now_ms() - 15000
                active = {
                    k: v for k, v in state["clients"].items()
                    if v.get("seenAt", 0) >= cutoff
                }
            self.send_json({
                "serverNow": now_ms(),
                "activeClients": list(active.values()),
                "count": len(active),
                "version": state["version"]
            })
            return

        if parsed.path == "/api/poll":
            qs = parse_qs(parsed.query)
            after = int(qs.get("after", ["0"])[0] or 0)
            client_id = qs.get("client", ["unknown"])[0]
            part = qs.get("part", [""])[0]

            with state_lock:
                state["clients"][client_id] = {
                    "id": client_id,
                    "part": part,
                    "seenAt": now_ms()
                }

                deadline = time.time() + 20
                while state["version"] <= after and time.time() < deadline:
                    state_lock.wait(timeout=max(0.1, deadline - time.time()))

                payload = {
                    "version": state["version"],
                    "command": state["command"],
                    "serverNow": now_ms()
                }

            self.send_json(payload)
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/heartbeat":
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                body = json.loads(raw.decode("utf-8"))
            except Exception:
                body = {}

            client_id = str(body.get("clientId") or "unknown")
            with state_lock:
                state["clients"][client_id] = {
                    "id": client_id,
                    "part": str(body.get("part") or ""),
                    "seenAt": now_ms()
                }
            self.send_json({"ok": True, "serverNow": now_ms()})
            return

        if parsed.path != "/api/command":
            self.send_json({"error": "not found"}, 404)
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8"))
        except Exception:
            self.send_json({"error": "invalid json"}, 400)
            return

        command = str(body.get("command") or "")
        data = body.get("data") or {}

        if command not in {"start", "pause", "stop", "speed", "accompaniment"}:
            self.send_json({"error": "unknown command"}, 400)
            return

        # Give all iPads time to receive START before the actual start moment.
        if command == "start":
            data = dict(data)
            data["startAt"] = now_ms() + 3500

        payload = {
            "command": command,
            "data": data,
            "sentAt": now_ms(),
            "id": f"{now_ms()}-{state['version'] + 1}"
        }

        with state_lock:
            state["version"] += 1
            state["command"] = payload
            version = state["version"]
            state_lock.notify_all()

        self.send_json({
            "ok": True,
            "version": version,
            "command": payload,
            "serverNow": now_ms()
        })

if __name__ == "__main__":
    os.chdir(ROOT)
    ip = local_ip()

    print("")
    print("==============================================")
    print("  ちゃいろのこびん Mac親機サーバー")
    print("==============================================")
    print(f"先生画面（Mac）: http://localhost:{PORT}/teacher-controller.html")
    print(f"先生画面（iPad）: http://{ip}:{PORT}/teacher-controller.html")
    print(f"生徒画面（iPad・音量0）: http://{ip}:{PORT}/index.html")
    print("")
    print("MacとiPadを同じWi-Fiにつないでください。")
    print("終了するときは、この画面で Control + C を押します。")
    print("==============================================")
    print("")

    try:
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        print(f"サーバーを開始できませんでした: {exc}")
        input("Enterキーで終了します。")
        raise SystemExit(1)

    def open_teacher_and_audio_source():
        webbrowser.open(f"http://localhost:{PORT}/teacher-controller.html")
        time.sleep(0.6)
        # This is the ORIGINAL student page, unchanged, used as the one audio source.
        webbrowser.open(f"http://localhost:{PORT}/index.html?role=audio")

    threading.Timer(1.0, open_teacher_and_audio_source).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nサーバーを終了します。")
    finally:
        httpd.server_close()

