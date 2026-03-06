export interface Env {
    WEBDAV_URL: string;
    WEBDAV_DIR?: string;
    ALLOWED_ORIGINS?: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // 0. 安全限制：检查 Origin 或 Referer
        let requestOrigin = request.headers.get("Origin") || request.headers.get("Referer") || "";
        
        let exactOrigin = requestOrigin;
        try {
            if (requestOrigin) {
                const parsedUrl = new URL(requestOrigin);
                exactOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;
            }
        } catch { }

        let allowedOrigin = "*";

        if (env.ALLOWED_ORIGINS) {
            const allowedList = env.ALLOWED_ORIGINS.split(",").map(url => url.trim().replace(/\/$/, ""));
            
            if (!requestOrigin) {
                // Return 403 if it's a browser request missing origin when origins are restricted.
                // But for pure curl requests without origin or referer, we might want to block as well.
                return new Response("403 Forbidden: Missing Origin or Referer header", { status: 403 });
            }

            const isAllowed = allowedList.some(allowed => {
                if (exactOrigin === allowed) return true;
                // 允许配置像 https://*.pages.dev 这样的通配符
                if (allowed.includes("*")) {
                    const regex = new RegExp("^" + allowed.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
                    return regex.test(exactOrigin);
                }
                return false;
            });
            
            if (!isAllowed) {
                return new Response(`403 Forbidden: Origin ${exactOrigin} is not allowed`, { status: 403 });
            }
            
            // 如果有限制，CORS Origin 限定为具体来路
            allowedOrigin = request.headers.get("Origin") || exactOrigin;
        }

        // 1. CORS 配置：允许跨域及所有 WebDAV 方法
        const corsHeaders: Record<string, string> = {
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK",
            "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*",
            "Access-Control-Expose-Headers": "*",
            "Access-Control-Max-Age": "86400",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (!env.WEBDAV_URL) {
            return new Response("Missing WEBDAV_URL in env", { status: 500, headers: corsHeaders });
        }

        // 2. 路由映射逻辑：保持与原先 Next.js 一致的 `/books` 替换逻辑
        const url = new URL(request.url);
        let path = url.pathname;
        const baseDir = env.WEBDAV_DIR || "/books";
        if (path.startsWith("/books")) {
            path = path.replace(/^\/books/, baseDir === "/" ? "" : baseDir);
        }

        // 3. 构建目标 URL
        const targetUrl = env.WEBDAV_URL.replace(/\/$/, "") + path + url.search;

        // 4. 重写 Header 并透传 Authorization（不存储任何凭据）
        const headers = new Headers(request.headers);
        headers.delete("Host");     // 必须移除前端请求的 Host
        headers.delete("Origin");
        headers.delete("Referer");

        // 针对 MOVE/COPY 等 WebDAV 操作，需要重写 Destination 的 URL 路径
        const destHeader = headers.get("Destination");
        if (destHeader) {
            try {
                const destUrl = new URL(destHeader);
                let destPath = destUrl.pathname;
                if (destPath.startsWith("/books")) {
                    destPath = destPath.replace(/^\/books/, baseDir === "/" ? "" : baseDir);
                }
                const newDest = env.WEBDAV_URL.replace(/\/$/, "") + destPath;
                headers.set("Destination", newDest);
            } catch {
                // Ignore parse errors, leave it as is
            }
        }

        // 5. 将原生请求流作为 body 转发给目标 WebDAV Server (实现 Streaming)
        const init: RequestInit = {
            method: request.method,
            headers: headers,
            redirect: "follow",
        };

        if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
            init.body = request.body; // request.body 是一个 ReadableStream，fetch 会自动以流式转发大文件
        }

        try {
            const response = await fetch(targetUrl, init);

            // 6. 处理响应的 CORS，让前端能访问所有自定义头信息
            const responseHeaders = new Headers(response.headers);
            responseHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
            responseHeaders.set("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"] as string);
            responseHeaders.set("Access-Control-Expose-Headers", "*");

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
            });
        } catch (e: any) {
            return new Response(`Proxy Error: ${e.message}`, { status: 502, headers: corsHeaders });
        }
    },
};
