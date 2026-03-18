import { McpSwitchboardServer } from './mcpSwitchboardServer.js';

const port = Number(process.env.PORT ?? '4000');

const server = new McpSwitchboardServer();

await server.addServer('test-server', 'http://127.0.0.1:3000/mcp');

await server.start(port);
