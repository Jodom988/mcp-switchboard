import express from 'express';

import { ApiPaths, DaemonDtos, MCP_PORT } from '../common/api';
import { McpsbConfig } from '../common/config';
import { ServiceProvider, SingletonBase } from '../common/service-provider';
import { assertNever } from '../common/util/assert-never';
import { McpSwitchboard } from './mcp-switchboard';
import { McpSwitchboardServer } from './mcp-switchboard-server';
import services from './services';

export class DaemonMain extends SingletonBase {
	private readonly config: McpsbConfig;
	private readonly switchboard: McpSwitchboard;
	private readonly mcpServer: McpSwitchboardServer;

	public constructor(sp: ServiceProvider) {
		super(sp);
		this.config = sp.resolveSingleton(McpsbConfig);
		this.switchboard = sp.resolveSingleton(McpSwitchboard);
		this.mcpServer = sp.resolveSingleton(McpSwitchboardServer);
	}

	public async run(): Promise<void> {
		const app = express();
		app.use(express.json());

		app.post(ApiPaths.addServer, async (req, res) => {
			const parsed = DaemonDtos.AddServerBodySchema.safeParse(req.body);
			if (!parsed.success) {
				res.status(400).json({ ok: false, error: parsed.error.message });
				return;
			}
			try {
				switch (parsed.data.type) {
					case 'http':
						await this.switchboard.addHttpServer(parsed.data.name, parsed.data.url);
						break;
					case 'cli':
						await this.switchboard.addCliServer(
							parsed.data.name,
							parsed.data.command,
							parsed.data.args,
						);
						break;
					default:
						assertNever(parsed.data);
				}
				res.json({ ok: true });
			} catch (err) {
				res
					.status(500)
					.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
			}
		});

		app.post(ApiPaths.removeServer, async (req, res) => {
			const parsed = DaemonDtos.RemoveServerBodySchema.safeParse(req.body);
			if (!parsed.success) {
				res.status(400).json({ ok: false, error: parsed.error.message });
				return;
			}
			try {
				await this.switchboard.removeServer(parsed.data.name);
				res.json({ ok: true });
			} catch (err) {
				res
					.status(500)
					.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
			}
		});

		app.post(ApiPaths.stop, (_req, res) => {
			res.json({ ok: true });
			process.exit(0);
		});

		app.listen(this.config.daemonPort, '127.0.0.1', () => {
			console.log(`Management server listening on http://127.0.0.1:${this.config.daemonPort}`);
		});

		await this.mcpServer.start(MCP_PORT);
		console.log(`MCP server listening on http://127.0.0.1:${MCP_PORT}/mcp`);
	}
}

(async () => {
	services.registerSingleton(DaemonMain);
	const main = services.resolveSingleton(DaemonMain);
	try {
		await main.run();
	} catch (err) {
		console.error('Fatal error:', err instanceof Error ? err.message : String(err));
		throw err;
	}
})();
