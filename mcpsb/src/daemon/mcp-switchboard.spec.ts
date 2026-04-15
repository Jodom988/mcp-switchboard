import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TestHttpMcp } from 'test-harnesses';
import { ServiceProvider } from '../common/service-provider';
import { McpSwitchboard } from './mcp-switchboard';

describe('McpSwitchboard', () => {
	let switchboard: McpSwitchboard;
	let server: TestHttpMcp;

	beforeAll(async () => {
		server = new TestHttpMcp(0);
		const url = await server.start();

		const sp = new ServiceProvider();
		sp.registerSingleton(McpSwitchboard);
		switchboard = sp.resolveSingleton(McpSwitchboard);

		await switchboard.addServer('test-server', url);
	});

	afterAll(() => server.stop());

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
			expect(result.structuredContent).toEqual({ greeting: 'Hello, World from http-mcp!' });
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
