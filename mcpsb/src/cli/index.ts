import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import {
	ApiPaths,
	MGMT_PORT,
	type AddServerBody,
	type ApiResponse,
	type RemoveServerBody,
} from '../common/api';

const mgmtUrl = `http://127.0.0.1:${MGMT_PORT}`;

async function post(path: string, body: unknown): Promise<ApiResponse> {
	const res = await fetch(`${mgmtUrl}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
	return res.json() as Promise<ApiResponse>;
}

const program = new Command();

program.name('mcpsb').description('MCP Switchboard CLI');

program
	.command('start')
	.description('Start the MCP switchboard daemon')
	.action(() => {
		const daemonPath = fileURLToPath(new URL('../daemon/index.js', import.meta.url));
		const child = spawn('node', [daemonPath], {
			detached: true,
			stdio: 'ignore',
		});
		child.unref();
		console.log(`Daemon started (PID: ${child.pid})`);
	});

program
	.command('stop')
	.description('Stop the MCP switchboard daemon')
	.action(async () => {
		const result = await post(ApiPaths.stop, {});
		console.log(result.ok ? 'Daemon stopped' : `Error: ${result.error}`);
	});

const addServer = program.command('add-server').description('Add a server to the switchboard');

addServer
	.command('http <name> <url>')
	.description('Add an HTTP MCP server')
	.action(async (name: string, url: string) => {
		const result = await post(ApiPaths.addServer, {
			type: 'http',
			name,
			url,
		} satisfies AddServerBody);
		console.log(result.ok ? `Server "${name}" added` : `Error: ${result.error}`);
	});

addServer
	.command('cli <name> <command> [args...]')
	.description('Add a CLI MCP server')
	.action(async (name: string, command: string, args: string[]) => {
		const result = await post(ApiPaths.addServer, {
			type: 'cli',
			name,
			command,
			args,
		} satisfies AddServerBody);
		console.log(result.ok ? `Server "${name}" added` : `Error: ${result.error}`);
	});

const removeServer = program
	.command('remove-server')
	.description('Remove a server from the switchboard');

removeServer
	.command('http <name>')
	.description('Remove an HTTP MCP server')
	.action(async (name: string) => {
		const result = await post(ApiPaths.removeServer, {
			type: 'http',
			name,
		} satisfies RemoveServerBody);
		console.log(result.ok ? `Server "${name}" removed` : `Error: ${result.error}`);
	});

removeServer
	.command('cli <name>')
	.description('Remove a CLI MCP server')
	.action(async (name: string) => {
		const result = await post(ApiPaths.removeServer, {
			type: 'cli',
			name,
		} satisfies RemoveServerBody);
		console.log(result.ok ? `Server "${name}" removed` : `Error: ${result.error}`);
	});

program.parse();
