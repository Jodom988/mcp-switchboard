
This project creates an MCP management tool called "MCP-Switchboard". It allows users to specify a set of MCP servers, and combines the MCP servers under different namespaces. So the tools will be named as `<server-name>.<tool-name>`.

The MCP server does not just pass through the tools calls, it catalogues them so they're easily discoverable and don't cause context bloat. The MCP server exposes the following tools:

### `list_tools`

Arguments:

* `namespace` (optional): The namespace to list the tools from. If not provided, it will list all tools and their descriptions.

Returns: A list of tools with their descriptions, organized by namespace

### `search_tools`

Arguments:
* `query`: Glob pattern to search for a tool. Combines the namespace and tool name as one string to search against. For example, `myserver.*` would match all tools in the `myserver` namespace, while `*.toolname` would match all tools named `toolname` across all namespaces.
* `max_results` (optional): The maximum number of results to return. If not provided, it will return all matching tools. If more tools match the query than the specified `max_results`, we will return an error indicating the query is too broad.

Returns: A list of tools that match the search query, including their descriptions.

### `get_tool_info`

Arguments:
* `namespace`: The namespace of the tool
* `tool_name`: The name of the tool

Returns: The description of the tool, including its arguments and return value

### `call_tool`

Arguments:
* `namespace`: The namespace of the tool to call
* `tool_name`: The name of the tool to call
* `args`: The arguments to pass to the tool

Returns: The result of the tool call

### `run_js_script`

Arguments:
* `script`: The JavaScript code to execute. The JS environment will have access to the global object `tools`, which contains all the tools registered in the MCP server. Each tool can be called as a function, for example, `tools.myserver.mytool(arg1, arg2)`. The JS environment will also have access to a global `console` object for logging.

Returns: The result of the script execution, as well as the stderr and stdout from the script execution. If the script errors, the error message will be printed to stderr.
