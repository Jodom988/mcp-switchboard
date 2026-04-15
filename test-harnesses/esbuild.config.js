import * as esbuild from 'esbuild'

await esbuild.build({
	entryPoints: ['src/test-http-mcp.ts', 'src/test-cli-mcp.ts'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outdir: 'dist',
})
