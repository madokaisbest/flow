import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from 'webdav'

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '500mb',
        },
        responseLimit: false,
    },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    let { url, username, password, method, path, body, format } = req.body

    url = url
    username = username
    password = password
    const baseDir = process.env.WEBDAV_DIR || '/books'

    if (!url || !method) {
        return res.status(400).json({ error: 'Missing parameters or server-side config' })
    }

    // Maps frontend path `/books` to the configurable backend directory
    let mappedPath = path || '/'
    if (mappedPath.startsWith('/books')) {
        mappedPath = mappedPath.replace(/^\/books/, baseDir === '/' ? '' : baseDir)
    }

    const client = createClient(url, { username, password })

    try {
        let result: any
        switch (method) {
            case 'getDirectoryContents':
                result = await client.getDirectoryContents(mappedPath || '/')
                break
            case 'getFileContents':
                result = await client.getFileContents(mappedPath, { format: format || 'text' })
                // 如果返回的是 ArrayBuffer，需要转为 Buffer 传输
                if (result instanceof ArrayBuffer || result instanceof Buffer) {
                    res.setHeader('Content-Type', 'application/octet-stream')
                    return res.send(Buffer.from(new Uint8Array(result as any)))
                }
                break
            case 'putFileContents':
                // body 会被自动解析为 base64 字符串以方便传输二进制
                const buffer = Buffer.from(body, 'base64')
                result = await client.putFileContents(mappedPath, buffer, { overwrite: true })
                break
            case 'createDirectory':
                result = await client.createDirectory(mappedPath)
                break
            case 'deleteFile':
                result = await client.deleteFile(mappedPath)
                break
            default:
                throw new Error(`Unsupported method: ${method}`)
        }
        res.status(200).json(result)
    } catch (error: any) {
        if (error.status === 404) {
            return res.status(200).json({ _404: true })
        }
        console.error('Proxy Error:', error)
        res.status(error.status || 500).json({ error: error.message })
    }
}
