import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createTestMcpServer } from './mcp-server-factory.js';

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
	res.writeHead(statusCode, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
}

function sendJsonRpcError(res: ServerResponse, statusCode: number, message: string) {
	sendJson(res, statusCode, { jsonrpc: '2.0', error: { code: -32000, message }, id: null });
}

export class TestHttpMcp {
	private readonly requestedPort: number

	private httpServer?: Server

	private listeningPort?: number

	public constructor(port: number) {
		this.requestedPort = port
	}

	public get port(): number {
		if (this.listeningPort === undefined) {
			throw new Error('Test HTTP MCP server has not been started')
		}

		return this.listeningPort
	}

	public get url(): string {
		return `http://127.0.0.1:${this.port}/mcp`
	}

	public async start(): Promise<string> {
		if (this.httpServer !== undefined) {
			throw new Error('Test HTTP MCP server is already running')
		}

		const httpServer = createServer((req, res) => this.handleRequest(req, res))

		await new Promise<void>((resolve, reject) => {
			httpServer.once('error', reject)
			httpServer.listen(this.requestedPort, '127.0.0.1', () => {
				httpServer.off('error', reject)
				resolve()
			})
		})

		const address = httpServer.address()
		if (typeof address !== 'object' || address === null) {
			await new Promise<void>((resolve, reject) =>
				httpServer.close(err => (err ? reject(err) : resolve())),
			)
			throw new Error('Expected AddressInfo from server.address()')
		}

		this.httpServer = httpServer
		this.listeningPort = address.port

		return this.url
	}

	public async stop(): Promise<void> {
		if (this.httpServer === undefined) {
			throw new Error('Test HTTP MCP server is not running')
		}

		const httpServer = this.httpServer
		this.httpServer = undefined
		this.listeningPort = undefined

		await new Promise<void>((resolve, reject) =>
			httpServer.close(err => (err ? reject(err) : resolve())),
		)
	}

	private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const url = new URL(req.url ?? '/', 'http://127.0.0.1')

		if (url.pathname !== '/mcp') {
			sendJson(res, 404, { error: 'Not found' })
			return
		}

		if (req.method !== 'POST') {
			sendJsonRpcError(res, 405, 'Method not allowed.')
			return
		}

		const server = createTestMcpServer('http-mcp')
		const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

		try {
			await server.connect(transport)
			await transport.handleRequest(req, res)
		} catch (err) {
			if (!res.headersSent) {
				sendJsonRpcError(res, 500, 'Internal server error')
			}
		} finally {
			await transport.close()
			await server.close()
		}
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const port = Number(process.env.PORT ?? '3000')
	const server = new TestHttpMcp(port)

	server
		.start()
		.then(url => {
			console.log(`Test MCP server listening on ${url}`)
		})
		.catch(err => {
			console.error('Error starting test MCP server:', err)
			process.exit(1)
		})
}
