"""只在本机提供原型静态资源，覆盖 Windows 的模块 MIME 映射。"""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PrototypeHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        # 原型迭代时不沿用模块缓存，避免用旧文件检查新代码。
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Issue Hub 本机原型预览")
    parser.add_argument("--directory", required=True)
    parser.add_argument("--port", type=int, default=18285)
    args = parser.parse_args()
    directory = Path(args.directory).resolve(strict=True)
    if not directory.is_dir():
        parser.error("静态根目录必须存在")
    handler = partial(PrototypeHandler, directory=str(directory))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        server.serve_forever()
