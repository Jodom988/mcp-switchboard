import { McpSwitchboard } from './mcpSwitchboard.js';

async function main() {
	const switchboard = new McpSwitchboard();

	console.log('Adding test server...');
	await switchboard.addServer('test-server', 'http://127.0.0.1:3000/mcp');
	console.log('Server added.\n');

	console.log('--- list_tools() ---');
	const allTools = switchboard.list_tools();
	console.log(JSON.stringify(allTools, null, 2));

	console.log('\n--- list_tools("test") ---');
	const nsTools = switchboard.list_tools('test');
	console.log(JSON.stringify(nsTools, null, 2));

	console.log('\n--- get_tool_info("test", "greet") ---');
	const greetInfo = switchboard.get_tool_info('test', 'greet');
	console.log(JSON.stringify(greetInfo, null, 2));

	console.log('\n--- get_tool_info("test", "add") ---');
	const addInfo = switchboard.get_tool_info('test', 'add');
	console.log(JSON.stringify(addInfo, null, 2));
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});