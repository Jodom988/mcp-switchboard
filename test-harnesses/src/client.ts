import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const SWITCHBOARD_URL = process.env.SWITCHBOARD_URL ?? 'http://127.0.0.1:4000/mcp';

const callTool = async (client: Client, name: string, args: Record<string, unknown>): Promise<CallToolResult> =>
	client.callTool({ name, arguments: args }) as Promise<CallToolResult>;

async function main() {
	const client = new Client({ name: 'test-harness-client', version: '1.0.0' });
	const transport = new StreamableHTTPClientTransport(new URL(SWITCHBOARD_URL));
	await client.connect(transport);
	console.log(`Connected to switchboard at ${SWITCHBOARD_URL}\n`);

	// list_tools
	console.log('--- list_tools (all) ---');
	let result = await callTool(client, 'list_tools', {});
	console.log(result.content[0]);

	// list_tools with namespace filter
	console.log('\n--- list_tools (namespace: test-server) ---');
	result = await callTool(client, 'list_tools', { namespace: 'test-server' });
	console.log(result.content[0]);

	// search_tools
	console.log('\n--- search_tools ("*.add") ---');
	result = await callTool(client, 'search_tools', { query: '*.add' });
	console.log(result.content[0]);

	// get_tool_info
	console.log('\n--- get_tool_info (test-server / greet) ---');
	result = await callTool(client, 'get_tool_info', { namespace: 'test-server', tool_name: 'greet' });
	console.log(result.content[0]);

	// call_tool
	console.log('\n--- call_tool (test-server / add, {a:10, b:32}) ---');
	result = await callTool(client, 'call_tool', { namespace: 'test-server', tool_name: 'add', args: { a: 10, b: 32 } });
	console.log(result.content[0]);

	// run_js_script
	console.log('\n--- run_js_script ---');
	result = await callTool(client, 'run_js_script', {
		script: `
const greeting = await tools['test-server'].greet({ name: 'World' });
console.log('greet result:', JSON.stringify(greeting));
const sum = await tools['test-server'].add({ a: 6, b: 7 });
console.log('add result:', JSON.stringify(sum));
return { greeting, sum };
`
	});
	console.log(result.content[0]);

	await client.close();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
