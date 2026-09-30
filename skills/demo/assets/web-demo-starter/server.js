import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = normalize(join(root, relative));
    if (!file.startsWith(root)) throw new Error("invalid path");
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
}).listen(port, "0.0.0.0", () => console.log(`Demo running on http://localhost:${port}`));
