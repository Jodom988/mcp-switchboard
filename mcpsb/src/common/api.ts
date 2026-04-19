import { z } from 'zod';

export const MCP_PORT = 4000;

export const ApiPaths = {
	ping: '/ping',
	stop: '/stop',
	addServer: '/add-server',
	removeServer: '/remove-server',
} as const;

export namespace DaemonDtos {
	export const AddHttpServerBodySchema = z.object({
		type: z.literal('http'),
		name: z.string(),
		url: z.string(),
	});
	export type AddHttpServerBody = z.infer<typeof AddHttpServerBodySchema>;

	export const AddCliServerBodySchema = z.object({
		type: z.literal('cli'),
		name: z.string(),
		command: z.string(),
		args: z.array(z.string()).optional(),
	});
	export type AddCliServerBody = z.infer<typeof AddCliServerBodySchema>;

	export const AddServerBodySchema = z.discriminatedUnion('type', [
		AddHttpServerBodySchema,
		AddCliServerBodySchema,
	]);
	export type AddServerBody = z.infer<typeof AddServerBodySchema>;

	export const RemoveServerBodySchema = z.object({
		type: z.enum(['http', 'cli']),
		name: z.string(),
	});
	export type RemoveServerBody = z.infer<typeof RemoveServerBodySchema>;

	export const ApiResponseSchema = z.object({
		ok: z.boolean(),
		error: z.string().optional(),
	});
	export type ApiResponse = z.infer<typeof ApiResponseSchema>;
}
