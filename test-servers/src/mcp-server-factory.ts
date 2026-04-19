import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

export function createTestMcpServer(source?: string) {
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
			content: [
				{ type: 'text', text: `Hello, ${name}${source !== undefined ? ` from ${source}` : ''}!` },
			],
			structuredContent: {
				greeting: `Hello, ${name}${source !== undefined ? ` from ${source}` : ''}!`,
			},
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

	return server;
}
