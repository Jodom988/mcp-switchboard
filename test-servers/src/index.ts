import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as z from 'zod/v4';

const port = Number(process.env.PORT ?? '3000');

const createMcpServer = () => {
	const server = new McpServer({
		name: 'test-servers',
		version: '1.0.0'
	});

	server.registerTool(
		'greet',
		{
			title: 'Greet',
			description: 'Greet the caller by name.',
			inputSchema: {
				name: z.string().describe('Name to greet')
			},
			outputSchema: {
				greeting: z.string()
			}
		},
		async ({ name }) => {
			console.log(`Greet tool called with name=${name}`);
			const greeting = `Hello, ${name}!`;

			return {
				content: [{ type: 'text', text: greeting }],
				structuredContent: { greeting }
			};
		}
	);

	server.registerTool(
		'add',
		{
			title: 'Add',
			description: 'Add two numbers together.',
			inputSchema: {
				a: z.number().describe('First number to add'),
				b: z.number().describe('Second number to add')
			},
			outputSchema: {
				sum: z.number()
			}
		},
		async ({ a, b }) => {
			console.log(`Add tool called with a=${a}, b=${b}`);
			const sum = a + b;

			return {
				content: [{ type: 'text', text: `${a} + ${b} = ${sum}` }],
				structuredContent: { sum }
			};
		}
	);

	return server;
};

const sendJson = (res: ServerResponse, statusCode: number, body: unknown) => {
	res.writeHead(statusCode, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
};

const sendJsonRpcError = (res: ServerResponse, statusCode: number, message: string) => {
	sendJson(res, statusCode, {
		jsonrpc: '2.0',
		error: {
			code: -32000,
			message
		},
		id: null
	});
};

const isMcpRequest = (req: IncomingMessage) => {
	const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
	return url.pathname === '/mcp';
};

const httpServer = createServer(async (req, res) => {
	if (!isMcpRequest(req)) {
		sendJson(res, 404, { error: 'Not found' });
		return;
	}

	if (req.method !== 'POST') {
		sendJsonRpcError(res, 405, 'Method not allowed.');
		return;
	}

	const server = createMcpServer();
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: undefined
	});

	try {
		await server.connect(transport);
		await transport.handleRequest(req, res);
	} catch (error) {
		console.error('Error handling MCP request:', error);

		if (!res.headersSent) {
			sendJsonRpcError(res, 500, 'Internal server error');
		}
	} finally {
		await transport.close();
		await server.close();
	}
});

httpServer.listen(port, () => {
	console.log(`Test MCP server listening on http://127.0.0.1:${port}/mcp`);
});
