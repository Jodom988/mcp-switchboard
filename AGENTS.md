# MCP-Switchboard

MCP-Switchboard is a multiplexing MCP server. It connects to any number of upstream MCP servers and re-exposes their tools under namespaces, so the tools appear as `<server-name>.<tool-name>`. Rather than flooding the context window with every tool from every server, it provides discovery tools so an agent can find and call only what it needs.

## Repository layout

```
mcpsb/          — the main package (the switchboard server)
  src/
    common/     — shared utilities (ServiceProvider DI engine)
    daemon/     — the runnable server (entry point, services, switchboard logic)
  esbuild.config.js
test-harnesses/ — standalone scripts for manual end-to-end testing
```

## Key concepts

**[ServiceProvider](mcpsb/src/common/service-provider.ts)** — a lightweight dependency injection container. Classes extend `SingletonBase` and receive a `ServiceProvider` in their constructor. Singletons are registered by class and resolved lazily.

**[McpSwitchboard](mcpsb/src/daemon/mcp-switchboard.ts)** — the core logic. Maintains connections to upstream MCP servers and implements all discovery and call-through operations.

**[McpSwitchboardServer](mcpsb/src/daemon/mcp-switchboard-server.ts)** — wraps `McpSwitchboard` in an MCP-compliant HTTP server, registering each operation as an MCP tool.

## Build & verify

```sh
cd mcpsb
npm run build    # compile with esbuild
npm run verify   # run unit tests + prettier format check
npm test         # unit tests only
```

## Code style

- **Formatter**: Prettier. Config at `.prettierrc.json` in the repo root. VS Code is configured to format on save.
- **Tabs** for indentation, **single quotes** for strings, **no semicolons**, **LF** line endings, `printWidth` of 100.
- Named functions use `function` declarations. Arrow functions are reserved for truly anonymous callbacks.
- `if` statements always use `{ }` bodies, even for single-line branches.
- Singleton fields resolved from a `ServiceProvider` are declared `private readonly`.
- No `as` type casts — use type guards to narrow instead.
- Test files are colocated with the file under test and named `<file>.spec.ts`.
- Kebab case for new files if they have multiple words
