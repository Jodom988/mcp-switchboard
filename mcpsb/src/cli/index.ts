import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { ApiPaths, DaemonDtos } from '../common/api';
import { McpsbConfig } from '../common/config';
import { ServiceProvider, SingletonBase } from '../common/service-provider';
import services from './services';

export class CliMain extends SingletonBase {
	private readonly config: McpsbConfig;

	public constructor(sp: ServiceProvider) {
		super(sp);
		this.config = sp.resolveSingleton(McpsbConfig);
	}

	private get mgmtUrl(): string {
		return `http://127.0.0.1:${this.config.daemonPort}`;
	}

	private async post(path: string, body: unknown): Promise<DaemonDtos.ApiResponse> {
		const res = await fetch(`${this.mgmtUrl}${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		});
		return DaemonDtos.ApiResponseSchema.parse(await res.json());
	}

	public run(): void {
		const program = new Command();
		program.name('mcpsb').description('MCP Switchboard CLI');

		program
			.command('start')
			.description('Start the MCP switchboard daemon')
			.action(() => {
				const daemonPath = fileURLToPath(new URL('../daemon/index.js', import.meta.url));
				console.log(`Daemon path: ${daemonPath}`);
				const child = spawn('bun', [daemonPath], {
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
				const result = await this.post(ApiPaths.stop, {});
				console.log(result.ok ? 'Daemon stopped' : `Error: ${result.error}`);
			});

		const addServer = program.command('add-server').description('Add a server to the switchboard');

		addServer
			.command('http <name> <url>')
			.description('Add an HTTP MCP server')
			.action(async (name: string, url: string) => {
				const result = await this.post(ApiPaths.addServer, {
					type: 'http',
					name,
					url,
				} satisfies DaemonDtos.AddServerBody);
				console.log(result.ok ? `Server "${name}" added` : `Error: ${result.error}`);
			});

		addServer
			.command('cli <name> <command> [args...]')
			.description('Add a CLI MCP server')
			.action(async (name: string, command: string, args: string[]) => {
				const result = await this.post(ApiPaths.addServer, {
					type: 'cli',
					name,
					command,
					args,
				} satisfies DaemonDtos.AddServerBody);
				console.log(result.ok ? `Server "${name}" added` : `Error: ${result.error}`);
			});

		const removeServer = program
			.command('remove-server')
			.description('Remove a server from the switchboard');

		removeServer
			.command('http <name>')
			.description('Remove an HTTP MCP server')
			.action(async (name: string) => {
				const result = await this.post(ApiPaths.removeServer, {
					type: 'http',
					name,
				} satisfies DaemonDtos.RemoveServerBody);
				console.log(result.ok ? `Server "${name}" removed` : `Error: ${result.error}`);
			});

		removeServer
			.command('cli <name>')
			.description('Remove a CLI MCP server')
			.action(async (name: string) => {
				const result = await this.post(ApiPaths.removeServer, {
					type: 'cli',
					name,
				} satisfies DaemonDtos.RemoveServerBody);
				console.log(result.ok ? `Server "${name}" removed` : `Error: ${result.error}`);
			});

		program.parse();
	}
}

(async () => {
	services.registerSingleton(CliMain);
	const main = services.resolveSingleton(CliMain);
	try {
		main.run();
	} catch (err) {
		console.error('Fatal error:', err instanceof Error ? err.message : String(err));
		throw err;
	}
})();
