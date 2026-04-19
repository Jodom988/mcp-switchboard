import * as esbuild from 'esbuild';

await esbuild.build({
	entryPoints: {
		'daemon/index': 'src/daemon/index.ts',
		'cli/index': 'src/cli/index.ts',
	},
	bundle: true,
	platform: 'node',
	format: 'esm',
	outdir: 'dist',
});
