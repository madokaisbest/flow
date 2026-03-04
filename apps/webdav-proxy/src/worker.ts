export interface Env {
    WEBDAV_URL: string;
    WEBDAV_DIR?: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // 1. CORS 配置：允许跨域及所有 WebDAV 方法
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK",
            "Access-Control-Allow-Headers": "*",
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
            responseHeaders.set("Access-Control-Allow-Origin", "*");
            responseHeaders.set("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"]);
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
