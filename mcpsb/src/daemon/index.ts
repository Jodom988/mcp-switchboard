import express from 'express';

import { ApiPaths, MCP_PORT, type AddServerBody, type RemoveServerBody } from '../common/api';
import { McpsbConfig } from '../common/config';
import { ServiceProvider, SingletonBase } from '../common/service-provider';
import { McpSwitchboard } from './mcp-switchboard';
import { McpSwitchboardServer } from './mcp-switchboard-server';
import services from './services';

export class McpDaemonMain extends SingletonBase {
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
			const body = req.body as AddServerBody;
			try {
				if (body.type === 'http') {
					await this.switchboard.addHttpServer(body.name, body.url);
				} else if (body.type === 'cli') {
					await this.switchboard.addCliServer(body.name, body.command, body.args);
				} else {
					res.status(400).json({ ok: false, error: 'Invalid type' });
					return;
				}
				res.json({ ok: true });
			} catch (err) {
				res
					.status(500)
					.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
			}
		});

		app.post(ApiPaths.removeServer, async (req, res) => {
			const body = req.body as RemoveServerBody;
			try {
				await this.switchboard.removeServer(body.name);
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
	services.registerSingleton(McpDaemonMain);
	const main = services.resolveSingleton(McpDaemonMain);
	try {
		await main.run();
	} catch (err) {
		console.error('Fatal error:', err instanceof Error ? err.message : String(err));
		throw err;
	}
})();
