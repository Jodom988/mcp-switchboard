import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { SingletonBase, ServiceProvider } from '../common/service-provider';
import { McpSwitchboard, McpSwitchboardTools } from './mcp-switchboard';

const sendJson = (res: ServerResponse, statusCode: number, body: unknown) => {
	res.writeHead(statusCode, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
};

const sendJsonRpcError = (res: ServerResponse, statusCode: number, message: string) => {
	sendJson(res, statusCode, { jsonrpc: '2.0', error: { code: -32000, message }, id: null });
};

export class McpSwitchboardServer extends SingletonBase {
	private readonly switchboard: McpSwitchboard;
	private mcpServer: McpServer;

	constructor(sp: ServiceProvider) {
		super(sp);
		this.switchboard = sp.resolveSingleton(McpSwitchboard);
		this.mcpServer = this.buildMcpServer();
	}

	async addServer(name: string, url: string): Promise<void> {
		await this.switchboard.addServer(name, url);
	}

	private buildMcpServer(): McpServer {
		const server = new McpServer({ name: 'mcp-switchboard', version: '1.0.0' });

		server.registerTool(
			'list_tools',
			{
				title: 'List Tools',
				description:
					'List all tools organized by namespace. Optionally filter to a single namespace.',
				inputSchema: McpSwitchboardTools.listTools.input.shape,
			},
			async ({ namespace }) => {
				const result = this.switchboard.list_tools({ namespace });
				return {
					content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
					structuredContent: result,
				};
			},
		);

		server.registerTool(
			'search_tools',
			{
				title: 'Search Tools',
				description:
					'Search for tools using a glob pattern matched against "namespace.toolname". ' +
					'Example: "myserver.*" matches all tools in myserver, "*.add" matches all tools named add.',
				inputSchema: McpSwitchboardTools.searchTools.input.shape,
			},
			async ({ query, max_results }) => {
				const result = this.switchboard.search_tools({ query, max_results });
				return {
					content: [{ type: 'text', text: JSON.stringify(result) }],
					structuredContent: { results: result },
				};
			},
		);

		server.registerTool(
			'get_tool_info',
			{
				title: 'Get Tool Info',
				description:
					'Get full details for a specific tool, including its input and output schemas.',
				inputSchema: McpSwitchboardTools.getToolInfo.input.shape,
			},
			async ({ namespace, tool_name }) => {
				const result = this.switchboard.get_tool_info({ namespace, tool_name });
				return {
					content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
					structuredContent: result,
				};
			},
		);

		server.registerTool(
			'call_tool',
			{
				title: 'Call Tool',
				description: 'Call a tool in a given namespace with the provided arguments.',
				inputSchema: McpSwitchboardTools.callTool.input.shape,
			},
			async ({ namespace, tool_name, args }) => {
				const result = await this.switchboard.call_tool({ namespace, tool_name, args });
				return {
					content: result.content as { type: 'text'; text: string }[],
					structuredContent: result.structuredContent as Record<string, unknown> | undefined,
				};
			},
		);

		server.registerTool(
			'run_js_script',
			{
				title: 'Run JS Script',
				description:
					'Execute a JavaScript script against all registered MCP tools. ' +
					'Tools are accessible via the global `tools` object using dot notation (`tools.namespace.toolName(args)`) ' +
					'or bracket notation (`tools["namespace"]["toolName"](args)`). All tool calls are async and must be awaited. ' +
					'Use `console.log(...)` to write to stdout and `console.error(...)` to write to stderr — both are captured in the output. ' +
					'The script runs as the body of an async function, so you can use `return` to provide a result value, ' +
					'and `await` at the top level.',
				inputSchema: McpSwitchboardTools.runJsScript.input.shape,
			},
			async ({ script, maxLen }) => {
				const output = await this.switchboard.run_js_script({ script, maxLen });
				return {
					content: [{ type: 'text', text: JSON.stringify(output) }],
					structuredContent: output,
				};
			},
		);

		return server;
	}

	start(port: number): Promise<void> {
		return new Promise(resolve => {
			const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
				const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

				if (url.pathname !== '/mcp') {
					sendJson(res, 404, { error: 'Not found' });
					return;
				}

				if (req.method !== 'POST') {
					sendJsonRpcError(res, 405, 'Method not allowed.');
					return;
				}

				const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

				try {
					await this.mcpServer.connect(transport);
					await transport.handleRequest(req, res);
				} catch (error) {
					console.error('Error handling MCP request:', error);
					if (!res.headersSent) {
						sendJsonRpcError(res, 500, 'Internal server error');
					}
				} finally {
					await transport.close();
				}
			});

			httpServer.listen(port, () => {
				console.log(`MCP Switchboard listening on http://127.0.0.1:${port}/mcp`);
				resolve();
			});
		});
	}
}
