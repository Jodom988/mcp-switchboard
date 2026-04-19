import express from 'express';

import {
	ApiPaths,
	MGMT_PORT,
	MCP_PORT,
	type AddServerBody,
	type RemoveServerBody,
} from '../common/api';
import { McpSwitchboard } from './mcp-switchboard';
import { McpSwitchboardServer } from './mcp-switchboard-server';
import services from './services';

const switchboard = services.resolveSingleton(McpSwitchboard);
const mcpServer = services.resolveSingleton(McpSwitchboardServer);

const app = express();
app.use(express.json());

app.post(ApiPaths.addServer, async (req, res) => {
	const body = req.body as AddServerBody;
	try {
		if (body.type === 'http') {
			await switchboard.addHttpServer(body.name, body.url);
		} else if (body.type === 'cli') {
			await switchboard.addCliServer(body.name, body.command, body.args);
		} else {
			res.status(400).json({ ok: false, error: 'Invalid type' });
			return;
		}
		res.json({ ok: true });
	} catch (err) {
		res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
	}
});

app.post(ApiPaths.removeServer, async (req, res) => {
	const body = req.body as RemoveServerBody;
	try {
		await switchboard.removeServer(body.name);
		res.json({ ok: true });
	} catch (err) {
		res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
	}
});

app.post(ApiPaths.stop, (_req, res) => {
	res.json({ ok: true });
	process.exit(0);
});

app.listen(MGMT_PORT, '127.0.0.1', () => {
	console.log(`Management server listening on http://127.0.0.1:${MGMT_PORT}`);
});

await mcpServer.start(MCP_PORT);
console.log(`MCP server listening on http://127.0.0.1:${MCP_PORT}/mcp`);
