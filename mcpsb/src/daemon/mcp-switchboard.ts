import vm from 'node:vm';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import micromatch from 'micromatch';
import * as z from 'zod/v4';

export namespace McpSwitchboardTools {
	const toolSummary = z.object({
		name: z.string(),
		description: z.string()
	});

	const jsonSchema = z.record(z.string(), z.unknown());

	const toolDetail = z.object({
		name: z.string(),
		title: z.string().optional(),
		description: z.string().optional(),
		inputSchema: jsonSchema,
		outputSchema: jsonSchema.optional()
	});

	export const listTools = {
		input: z.object({
			namespace: z.string().optional()
		}),
		output: z.record(z.string(), z.array(toolSummary))
	};
	export type ListToolsInput = z.infer<typeof listTools.input>;
	export type ListToolsOutput = z.infer<typeof listTools.output>;

	export const searchTools = {
		input: z.object({
			query: z.string(),
			max_results: z.number().int().positive().optional()
		}),
		output: z.array(
			z.object({
				namespace: z.string(),
				name: z.string(),
				description: z.string()
			})
		)
	};
	export type SearchToolsInput = z.infer<typeof searchTools.input>;
	export type SearchToolsOutput = z.infer<typeof searchTools.output>;

	export const getToolInfo = {
		input: z.object({
			namespace: z.string(),
			tool_name: z.string()
		}),
		output: z.object({
			namespace: z.string(),
			tool: toolDetail
		})
	};
	export type GetToolInfoInput = z.infer<typeof getToolInfo.input>;
	export type GetToolInfoOutput = z.infer<typeof getToolInfo.output>;

	export const callTool = {
		input: z.object({
			namespace: z.string(),
			tool_name: z.string(),
			args: z.record(z.string(), z.unknown()).optional().default({})
		}),
		output: z.object({
			content: z.array(z.record(z.string(), z.unknown())),
			isError: z.boolean().optional()
		})
	};
	export type CallToolInput = z.infer<typeof callTool.input>;
	export type CallToolOutput = z.infer<typeof callTool.output>;

	export const runJsScript = {
		input: z.object({
			script: z.string().describe('JavaScript code to execute.'),
			maxLen: z
				.object({
					stdout: z
						.number()
						.int()
						.positive()
						.optional()
						.describe('Max characters of stdout to return. If exceeded, the output is clipped and "…" is appended.'),
					stderr: z
						.number()
						.int()
						.positive()
						.optional()
						.describe('Max characters of stderr to return. If exceeded, the output is clipped and "…" is appended.'),
					result: z
						.number()
						.int()
						.positive()
						.optional()
						.describe(
							'Max characters of the JSON-stringified result to return. If exceeded, the output is clipped and "…" is appended.'
						)
				})
				.describe(
					'Optional per-field length limits. Any field that exceeds its limit is clipped and "…" is appended to signal truncation.'
				)
				.optional()
		}),
		output: z.object({
			result: z.unknown(),
			stdout: z.string(),
			stderr: z.string()
		})
	};
	export type RunJsScriptInput = z.infer<typeof runJsScript.input>;
	export type RunJsScriptOutput = z.infer<typeof runJsScript.output>;
}

interface ServerEntry {
	client: Client;
	tools: Tool[];
}

export class McpSwitchboard {
	private servers = new Map<string, ServerEntry>();

	async addServer(name: string, url: string): Promise<void> {
		const client = new Client({ name: `switchboard-client-${name}`, version: '1.0.0' });
		const transport = new StreamableHTTPClientTransport(new URL(url));

		await client.connect(transport);

		const { tools } = await client.listTools();

		this.servers.set(name, { client, tools });
	}

	list_tools({ namespace }: McpSwitchboardTools.ListToolsInput = {}): McpSwitchboardTools.ListToolsOutput {
		const result: McpSwitchboardTools.ListToolsOutput = {};

		for (const [ns, { tools }] of this.servers) {
			if (namespace !== undefined && ns !== namespace) {
				continue;
			}

			result[ns] = tools.map((tool) => ({
				name: tool.name,
				description: tool.description ?? ''
			}));
		}

		return result;
	}

	search_tools({ query, max_results }: McpSwitchboardTools.SearchToolsInput): McpSwitchboardTools.SearchToolsOutput {
		const candidates: McpSwitchboardTools.SearchToolsOutput = [];

		for (const [ns, { tools }] of this.servers) {
			for (const tool of tools) {
				candidates.push({ namespace: ns, name: tool.name, description: tool.description ?? '' });
			}
		}

		const keys = candidates.map((c) => `${c.namespace}.${c.name}`);
		const matched = micromatch(keys, query);

		if (max_results !== undefined && matched.length > max_results) {
			throw new Error(
				`Query "${query}" matched ${matched.length} tools, which exceeds max_results=${max_results}. Narrow your query.`
			);
		}

		const matchedSet = new Set(matched);
		return candidates.filter((c) => matchedSet.has(`${c.namespace}.${c.name}`));
	}

	async call_tool({ namespace, tool_name, args }: McpSwitchboardTools.CallToolInput) {
		const server = this.servers.get(namespace);
		if (!server) {
			throw new Error(`Namespace "${namespace}" not found`);
		}

		return server.client.callTool({ name: tool_name, arguments: args });
	}

	get_tool_info({ namespace, tool_name }: McpSwitchboardTools.GetToolInfoInput): McpSwitchboardTools.GetToolInfoOutput {
		const server = this.servers.get(namespace);
		if (!server) {
			throw new Error(`Namespace "${namespace}" not found`);
		}

		const tool = server.tools.find((t) => t.name === tool_name);
		if (!tool) {
			throw new Error(`Tool "${tool_name}" not found in namespace "${namespace}"`);
		}

		return { namespace, tool };
	}

	async run_js_script({ script, maxLen }: McpSwitchboardTools.RunJsScriptInput): Promise<McpSwitchboardTools.RunJsScriptOutput> {
		const src = script;
		const stdout: string[] = [];
		const stderr: string[] = [];

		const toolsProxy: Record<string, Record<string, (args?: Record<string, unknown>) => Promise<unknown>>> = {};

		for (const [ns, tools] of Object.entries(this.list_tools())) {
			toolsProxy[ns] = {};
			for (const tool of tools) {
				toolsProxy[ns][tool.name] = async (args = {}) => {
					const res = await this.call_tool({ namespace: ns, tool_name: tool.name, args });
					return res.structuredContent ?? res.content;
				};
			}
		}

		const context = vm.createContext({
			tools: toolsProxy,
			console: {
				log: (...args: unknown[]) => stdout.push(args.map(String).join(' ')),
				error: (...args: unknown[]) => stderr.push(args.map(String).join(' ')),
				warn: (...args: unknown[]) => stderr.push(args.map(String).join(' '))
			},
			Promise,
			setTimeout,
			clearTimeout
		});

		let result: unknown;
		try {
			result = await vm.runInNewContext(`(async () => {\n${src}\n})()`, context);
		} catch (err) {
			stderr.push(err instanceof Error ? `${err.message}\n${err.stack ?? ''}`.trim() : String(err));
		}

		const clip = (s: string, limit: number | undefined) =>
			limit !== undefined && s.length > limit ? s.slice(0, limit) + '…' : s;

		const stdoutStr = clip(stdout.join('\n'), maxLen?.stdout);
		const stderrStr = clip(stderr.join('\n'), maxLen?.stderr);

		let resultValue: unknown = result ?? null;
		if (maxLen?.result !== undefined) {
			const serialized = JSON.stringify(resultValue);
			if (serialized.length > maxLen.result) {
				resultValue = serialized.slice(0, maxLen.result) + '…';
			}
		}

		return {
			result: resultValue,
			stdout: stdoutStr,
			stderr: stderrStr
		};
	}
}
