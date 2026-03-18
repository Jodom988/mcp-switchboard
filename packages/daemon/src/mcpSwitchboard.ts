import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

interface NamespacedTool {
	namespace: string;
	tool: Tool;
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

	list_tools(namespace?: string): Record<string, Array<{ name: string; description: string }>> {
		const result: Record<string, Array<{ name: string; description: string }>> = {};

		for (const [ns, { tools }] of this.servers) {
			if (namespace !== undefined && ns !== namespace) continue;

			result[ns] = tools.map((tool) => ({
				name: tool.name,
				description: tool.description ?? ''
			}));
		}

		return result;
	}

	get_tool_info(namespace: string, tool_name: string): NamespacedTool {
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
}
