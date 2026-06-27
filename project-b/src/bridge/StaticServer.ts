/**
 * StaticServer.ts
 *
 * A minimal HTTP server that serves the project-a/src/ directory on
 * http://127.0.0.1:8766. This allows the operator to load the OBS
 * Custom Browser Dock and Browser Source via HTTP URLs instead of
 * file:// paths, which are harder to type and error-prone.
 *
 * Both the dock (index.html) and the browser source (browser_source.html)
 * are served from the same origin (http://127.0.0.1:8766), which ensures
 * BroadcastChannel works correctly between them.
 *
 * Uses only Node.js built-in modules (http, fs, path, net) — no extra
 * dependencies required.
 *
 * Sprint 11: started in ObsBibleCompanionInstance.init(), stopped in
 * destroy(), alongside the RelayServer.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { readFile } from 'fs'
import { resolve, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Socket } from 'net'

// ---------------------------------------------------------------------------
// MIME types for files the OBS plugin uses
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
}

const DEFAULT_MIME = 'application/octet-stream'

// ---------------------------------------------------------------------------
// StaticServer
// ---------------------------------------------------------------------------

export class StaticServer {
  private readonly port:    number
  private readonly rootDir: string
  private server:  Server | null = null
  private sockets: Set<Socket>   = new Set()

  /**
   * @param port    Port to listen on (default 8766)
   * @param rootDir Absolute path to the directory to serve.
   *                Defaults to project-a/src/ relative to this file.
   */
  constructor(port: number = 8766, rootDir?: string) {
    this.port = port
    if (rootDir) {
      this.rootDir = rootDir
    } else {
      const __dirname = dirname(fileURLToPath(import.meta.url))
      this.rootDir = resolve(__dirname, '../../../project-a/src')
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        resolve()
        return
      }

      this.sockets = new Set()
      this.server  = createServer((req, res) => {
        this.handleRequest(req, res)
      })

      // Track open sockets so stop() can destroy them immediately
      this.server.on('connection', (socket: Socket) => {
        this.sockets.add(socket)
        socket.once('close', () => { this.sockets.delete(socket) })
      })

      this.server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          const msg =
            `[StaticServer] ERROR: Port ${this.port} is already in use.\n` +
            `  → Close whatever is using port ${this.port} and try again.`
          console.error(msg)
          this.server = null
          reject(new Error(msg))
        } else {
          reject(err)
        }
      })

      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`[StaticServer] Serving ${this.rootDir} on http://127.0.0.1:${this.port}`)
        resolve()
      })
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve()
        return
      }
      // Destroy all open keep-alive sockets immediately so the port is
      // released before the close callback fires. Without this, Node keeps
      // the port occupied until idle connections time out, causing EADDRINUSE
      // in tests that start a new server on the same port right after stop().
      for (const socket of this.sockets) {
        socket.destroy()
      }
      this.sockets.clear()

      this.server.close(() => {
        console.log('[StaticServer] Stopped.')
        this.server = null
        resolve()
      })
    })
  }

  get isRunning(): boolean {
    return this.server !== null
  }

  // -------------------------------------------------------------------------
  // Request handler
  // -------------------------------------------------------------------------

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain' })
      res.end('Method Not Allowed')
      return
    }

    const rawPath = req.url?.split('?')[0] ?? '/'
    const urlPath = decodeURIComponent(rawPath)
    const filePath = urlPath === '/' || urlPath === ''
      ? resolve(this.rootDir, 'index.html')
      : resolve(this.rootDir, urlPath.replace(/^\//, ''))

    // Security: ensure the resolved path stays within rootDir
    if (!filePath.startsWith(this.rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Forbidden')
      return
    }

    const ext  = extname(filePath).toLowerCase()
    const mime = MIME_TYPES[ext] ?? DEFAULT_MIME

    readFile(filePath, (err, data) => {
      if (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not Found')
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Internal Server Error')
        }
        return
      }

      res.writeHead(200, { 'Content-Type': mime })
      res.end(data)
    })
  }
}