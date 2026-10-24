"""
Haven Local Production Server
Serves the website on port 3000 with RFC 6266 Content-Disposition headers
Ensures clean, unambiguous file names for all browser downloads.
"""

import http.server
import os
import socketserver
import urllib.parse

PORT = 3000
SITE_DIR = os.path.abspath("site")


class HavenRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE_DIR, **kwargs)

    def guess_type(self, path):
        if path.endswith(".exe"):
            return "application/vnd.microsoft.portable-executable"
        elif path.endswith(".zip"):
            return "application/zip"
        return super().guess_type(path)

    def end_headers(self):
        req_path = urllib.parse.urlparse(self.path).path
        if "/downloads/" in req_path:
            filename = os.path.basename(req_path)
            # Enforce strict Content-Disposition so browsers never save as UUIDs or temp blobs
            self.send_header(
                "Content-Disposition",
                f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}',
            )
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        
        # Security & CORS headers
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


class DualStackServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    server_address = ("", PORT)
    with DualStackServer(server_address, HavenRequestHandler) as httpd:
        print(f"Haven Server listening on http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
