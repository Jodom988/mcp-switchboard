import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TestHttpMcp } from 'test-servers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const DAEMON_PORT = 19595;
const MCP_PORT = 19596;
const CONFIG_PATH = path.resolve(import.meta.dirname, 'integration.config.json');
const CLI_MCP_PATH = path.resolve(import.meta.dirname, '../../test-servers/dist/test-cli-mcp.js');

function resetConfigFile(): void {
	fs.writeFileSync(
		CONFIG_PATH,
		JSON.stringify({ daemonPort: DAEMON_PORT, mcpPort: MCP_PORT }, null, '\t') + '\n',
		'utf-8',
	);
}

async function waitForDaemon(timeoutMs = 5000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/ping`);
			if (res.status < 500) {
				return true;
			}
		} catch {
			// not ready yet
		}
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	return false;
}

async function runCli(...args: string[]): Promise<{ code: number; stdout: string }> {
	const runCliScriptPath = path.resolve(import.meta.dirname, '../run-cli.sh');
	const env = {
		...process.env,
		MCPSB_CONFIG_PATH: CONFIG_PATH,
	};
	return new Promise(resolve => {
		const proc = spawn(runCliScriptPath, [...args], { env });
		let stdout = '';
		proc.stdout.on('data', chunk => (stdout += chunk));
		proc.on('close', code => resolve({ code: code ?? 1, stdout }));
	});
}

async function createMcpClient(): Promise<Client> {
	const client = new Client({ name: 'test-client', version: '1.0.0' });
	const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${MCP_PORT}/mcp`));
	await client.connect(transport);
	return client;
}

describe('daemon lifecycle', () => {
	it('starts and stops via CLI', async () => {
		await runCli('start');

		const started = await waitForDaemon();
		expect(started, 'daemon should be reachable after start').toBe(true);

		const { code, stdout } = await runCli('stop');
		expect(stdout.trim()).toBe('Daemon stopped');
		expect(code).toBe(0);
	}, 10_000);
});

interface TransportConfig {
	label: string;
	setup: () => Promise<() => Promise<void>>;
	expectedGreeting: (name: string) => string;
}

const transportConfigs: TransportConfig[] = [
	{
		label: 'HTTP',
		expectedGreeting: name => `Hello, ${name} from http-mcp!`,
		setup: async () => {
			const server = new TestHttpMcp(0);
			const url = await server.start();
			await runCli('add-server', 'http', 'test-server', url);
			return () => server.stop();
		},
	},
	{
		label: 'CLI',
		expectedGreeting: name => `Hello, ${name} from cli-mcp!`,
		setup: async () => {
			await runCli('add-server', 'cli', 'test-server', 'node', CLI_MCP_PATH);
			return async () => {};
		},
	},
];

for (const { label, setup, expectedGreeting } of transportConfigs) {
	describe(`MCP server registration (${label})`, () => {
		let teardown: () => Promise<void>;
		let client: Client;

		beforeEach(async () => {
			resetConfigFile();
			await runCli('start');
			await waitForDaemon();
			teardown = await setup();
			client = await createMcpClient();
		}, 10_000);

		afterEach(async () => {
			await client.close();
			await teardown();
			await runCli('stop');
		}, 10_000);

		describe('list_tools', () => {
			it('returns all tools grouped by namespace', async () => {
				const result = await client.callTool({ name: 'list_tools', arguments: {} });
				const tools = JSON.parse((result.content as { type: 'text'; text: string }[])[0].text);
				expect(tools).toHaveProperty('test-server');
				expect(tools['test-server'].map((t: { name: string }) => t.name)).toEqual(
					expect.arrayContaining(['greet', 'add']),
				);
			});

			it('filters to a single namespace', async () => {
				const result = await client.callTool({
					name: 'list_tools',
					arguments: { namespace: 'test-server' },
				});
				const tools = JSON.parse((result.content as { type: 'text'; text: string }[])[0].text);
				expect(Object.keys(tools)).toEqual(['test-server']);
			});

			it('returns empty when namespace does not exist', async () => {
				const result = await client.callTool({
					name: 'list_tools',
					arguments: { namespace: 'unknown' },
				});
				const tools = JSON.parse((result.content as { type: 'text'; text: string }[])[0].text);
				expect(tools).toEqual({});
			});
		});

		describe('search_tools', () => {
			it('matches all tools in a namespace with wildcard', async () => {
				const result = await client.callTool({
					name: 'search_tools',
					arguments: { query: 'test-server.*' },
				});
				const { results } = result.structuredContent as { results: { name: string }[] };
				expect(results.map(t => t.name)).toEqual(expect.arrayContaining(['greet', 'add']));
			});

			it('matches a specific tool across namespaces', async () => {
				const result = await client.callTool({
					name: 'search_tools',
					arguments: { query: '*.add' },
				});
				const { results } = result.structuredContent as {
					results: { namespace: string; name: string }[];
				};
				expect(results).toHaveLength(1);
				expect(results[0]).toMatchObject({ namespace: 'test-server', name: 'add' });
			});
		});

		describe('get_tool_info', () => {
			it('returns full tool details', async () => {
				const result = await client.callTool({
					name: 'get_tool_info',
					arguments: { namespace: 'test-server', tool_name: 'greet' },
				});
				const info = result.structuredContent as {
					namespace: string;
					tool: { name: string; description: string };
				};
				expect(info.namespace).toBe('test-server');
				expect(info.tool.name).toBe('greet');
				expect(info.tool.description).toBe('Greet the caller by name.');
			});
		});

		describe('call_tool', () => {
			it('calls the greet tool', async () => {
				const name = 'World';
				const result = await client.callTool({
					name: 'call_tool',
					arguments: { namespace: 'test-server', tool_name: 'greet', args: { name } },
				});
				expect(result.structuredContent).toEqual({ greeting: expectedGreeting(name) });
			});

			it('calls the add tool', async () => {
				const result = await client.callTool({
					name: 'call_tool',
					arguments: { namespace: 'test-server', tool_name: 'add', args: { a: 10, b: 32 } },
				});
				expect(result.structuredContent).toEqual({ sum: 42 });
			});
		});

		describe('run_js_script', () => {
			it('executes a script and returns a result', async () => {
				const result = await client.callTool({
					name: 'run_js_script',
					arguments: { script: `return await tools['test-server'].add({ a: 6, b: 7 })` },
				});
				const output = result.structuredContent as { result: unknown };
				expect(output.result).toMatchObject({ sum: 13 });
			});

			it('captures console.log output in stdout', async () => {
				const result = await client.callTool({
					name: 'run_js_script',
					arguments: { script: `console.log('hello from script')` },
				});
				const output = result.structuredContent as { stdout: string };
				expect(output.stdout).toBe('hello from script');
			});

			it('captures thrown errors in stderr', async () => {
				const result = await client.callTool({
					name: 'run_js_script',
					arguments: { script: `throw new Error('boom')` },
				});
				const output = result.structuredContent as { stderr: string };
				expect(output.stderr).toMatch(/boom/);
			});
		});
	});
}
