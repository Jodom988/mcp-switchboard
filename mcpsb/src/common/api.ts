export const MCP_PORT = 4000;
export const MGMT_PORT = 4001;

export const ApiPaths = {
	stop: '/stop',
	addServer: '/add-server',
	removeServer: '/remove-server',
} as const;

export interface AddHttpServerBody {
	type: 'http';
	name: string;
	url: string;
}

export interface AddCliServerBody {
	type: 'cli';
	name: string;
	command: string;
	args?: string[];
}

export type AddServerBody = AddHttpServerBody | AddCliServerBody;

export interface RemoveServerBody {
	type: 'http' | 'cli';
	name: string;
}

export interface ApiResponse {
	ok: boolean;
	error?: string;
}
