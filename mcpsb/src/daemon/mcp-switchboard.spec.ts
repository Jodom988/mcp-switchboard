import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as z from 'zod/v4';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ServiceProvider } from '../common/service-provider';
import { McpSwitchboard } from './mcp-switchboard';

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
	res.writeHead(statusCode, { 'content-type': 'application/json' })
	res.end(JSON.stringify(body))
}

function sendJsonRpcError(res: ServerResponse, statusCode: number, message: string) {
	sendJson(res, statusCode, { jsonrpc: '2.0', error: { code: -32000, message }, id: null })
}

function createTestMcpServer() {
	const server = new McpServer({ name: 'test-server', version: '1.0.0' });

	server.registerTool(
		'greet',
		{
			title: 'Greet',
			description: 'Greet the caller by name.',
			inputSchema: { name: z.string().describe('Name to greet') },
			outputSchema: { greeting: z.string() },
		},
		async ({ name }) => ({
			content: [{ type: 'text', text: `Hello, ${name}!` }],
			structuredContent: { greeting: `Hello, ${name}!` },
		}),
	);

	server.registerTool(
		'add',
		{
			title: 'Add',
			description: 'Add two numbers together.',
			inputSchema: {
				a: z.number().describe('First number'),
				b: z.number().describe('Second number'),
			},
			outputSchema: { sum: z.number() },
		},
		async ({ a, b }) => ({
			content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }],
			structuredContent: { sum: a + b },
		}),
	);

	return server
}

function startTestServer(): Promise<{ url: string; stop: () => Promise<void> }> {
	return new Promise((resolve, reject) => {
		const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
			const url = new URL(req.url ?? '/', `http://127.0.0.1`);

			if (url.pathname !== '/mcp') {
				sendJson(res, 404, { error: 'Not found' });
				return;
			}

			if (req.method !== 'POST') {
				sendJsonRpcError(res, 405, 'Method not allowed.');
				return;
			}

			const server = createTestMcpServer();
			const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

			try {
				await server.connect(transport);
				await transport.handleRequest(req, res);
			} catch (err) {
				if (!res.headersSent) {
					sendJsonRpcError(res, 500, 'Internal server error')
				}
			} finally {
				await transport.close();
				await server.close();
			}
		});

		httpServer.listen(0, '127.0.0.1', () => {
			const address = httpServer.address();
			if (typeof address !== 'object' || address === null) {
				reject(new Error('Expected AddressInfo from server.address()'));
				return;
			}
			resolve({
				url: `http://127.0.0.1:${address.port}/mcp`,
				stop: () => new Promise((res, rej) => httpServer.close(err => (err ? rej(err) : res()))),
			});
		});

		httpServer.on('error', reject)
	})
}

// --- Tests ---

describe('McpSwitchboard', () => {
	let switchboard: McpSwitchboard;
	let stopServer: () => Promise<void>;

	beforeAll(async () => {
		const { url, stop } = await startTestServer();
		stopServer = stop;

		const sp = new ServiceProvider();
		sp.registerSingleton(McpSwitchboard);
		switchboard = sp.resolveSingleton(McpSwitchboard);

		await switchboard.addServer('test-server', url);
	});

	afterAll(() => stopServer());

	describe('list_tools', () => {
		it('returns all tools grouped by namespace', () => {
			const result = switchboard.list_tools();
			expect(result).toHaveProperty('test-server');
			expect(result['test-server'].map(t => t.name)).toEqual(
				expect.arrayContaining(['greet', 'add']),
			);
		});

		it('filters to a single namespace', () => {
			const result = switchboard.list_tools({ namespace: 'test-server' });
			expect(Object.keys(result)).toEqual(['test-server']);
		});

		it('returns empty when namespace does not exist', () => {
			const result = switchboard.list_tools({ namespace: 'unknown' });
			expect(result).toEqual({});
		});
	});

	describe('search_tools', () => {
		it('matches all tools in a namespace with wildcard', () => {
			const result = switchboard.search_tools({ query: 'test-server.*' });
			expect(result.map(t => t.name)).toEqual(expect.arrayContaining(['greet', 'add']));
		});

		it('matches a specific tool across namespaces', () => {
			const result = switchboard.search_tools({ query: '*.add' });
			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({ namespace: 'test-server', name: 'add' });
		});

		it('throws when results exceed max_results', () => {
			expect(() => switchboard.search_tools({ query: 'test-server.*', max_results: 1 })).toThrow(
				/exceeds max_results/,
			);
		});
	});

	describe('get_tool_info', () => {
		it('returns full tool details', () => {
			const result = switchboard.get_tool_info({ namespace: 'test-server', tool_name: 'greet' });
			expect(result.namespace).toBe('test-server');
			expect(result.tool.name).toBe('greet');
			expect(result.tool.description).toBe('Greet the caller by name.');
		});

		it('throws for an unknown namespace', () => {
			expect(() => switchboard.get_tool_info({ namespace: 'unknown', tool_name: 'greet' })).toThrow(
				/not found/,
			);
		});

		it('throws for an unknown tool', () => {
			expect(() =>
				switchboard.get_tool_info({ namespace: 'test-server', tool_name: 'unknown' }),
			).toThrow(/not found/);
		});
	});

	describe('call_tool', () => {
		it('calls the add tool and returns the sum', async () => {
			const result = await switchboard.call_tool({
				namespace: 'test-server',
				tool_name: 'add',
				args: { a: 10, b: 32 },
			});
			expect(result.structuredContent).toEqual({ sum: 42 });
		});

		it('calls the greet tool and returns a greeting', async () => {
			const result = await switchboard.call_tool({
				namespace: 'test-server',
				tool_name: 'greet',
				args: { name: 'World' },
			});
			expect(result.structuredContent).toEqual({ greeting: 'Hello, World!' });
		});

		it('throws for an unknown namespace', async () => {
			await expect(
				switchboard.call_tool({ namespace: 'unknown', tool_name: 'add', args: {} }),
			).rejects.toThrow(/not found/);
		});
	});

	describe('run_js_script', () => {
		it('executes a script and returns a result', async () => {
			const { result } = await switchboard.run_js_script({
				script: `return await tools['test-server'].add({ a: 6, b: 7 })`,
			});
			expect(result).toMatchObject({ sum: 13 });
		});

		it('captures console.log output in stdout', async () => {
			const { stdout } = await switchboard.run_js_script({
				script: `console.log('hello from script')`,
			});
			expect(stdout).toBe('hello from script');
		});

		it('captures thrown errors in stderr', async () => {
			const { stderr } = await switchboard.run_js_script({
				script: `throw new Error('boom')`,
			});
			expect(stderr).toMatch(/boom/);
		});

		it('clips output when maxLen is set', async () => {
			const { stdout } = await switchboard.run_js_script({
				script: `console.log('hello world')`,
				maxLen: { stdout: 5 },
			});
			expect(stdout).toBe('hello…');
		});
	});
});
