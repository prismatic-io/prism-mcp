# Prism MCP Server

`prism-mcp` is a local MCP (Model Context Protocol) server that wraps Prismatic's Prism CLI tool, allowing AI assistants to interact with Prismatic dev tooling directly.

In the future, we may extend this MCP server to include other actions that may be helpful to Prismatic Code-Native devs, even if they're not currently available in [prism](https://github.com/prismatic-io/prism). So despite the name, imagine that this is really a "Prismatic Dev Ex Server" rather than just a `prism` wrapper specifically!

**NOTE: This tool is highly experimental.**

## Features

This MCP server provides the following tools:

- **prism_me**: Check login status and display current user profile information
- **prism_integrations_list**: List all integrations with filtering options
- **prism_integrations_init**: Initialize a new Code Native Integration
- **prism_integrations_convert**: Convert a Low-Code Integration's YAML file to Code Native
- **prism_integrations_flows_list**: List flows for an integration
- **prism_integrations_import**: Import an integration from a specific directory
- **prism_integrations_flows_test**: Test a flow in an integration
- **prism_components_list**: List all available components with version options
- **prism_components_init**: Initialize a new Component (supports WSDL/OpenAPI generation)
- **prism_components_publish**: Publish a component from a specific directory
- **prism_components_generate_manifest**: Generate the manifest for a Prismatic component

## Prerequisites

1. Install the Prism CLI globally:
   ```bash
   npm install --global @prismatic-io/prism
   ```

2. Authenticate with Prismatic:
   ```bash
   prism login
   ```

## Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd prism-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Usage

### Config

Configuration location and methods vary slightly depending on the AI tool you are using, but the following is relatively standard. More specific instructions for Claude and Cursor are below.

Example setup:

```json
{
  "mcpServers": {
    "prism": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/prism-mcp/dist/index.js"
      ],
      "env": {
        "WORKING_DIRECTORY": "/path/to/the/work/dir/"
      }
    }
  }
}
```

Replace the path args as needed.

Environment variable options:

* `WORKING_DIRECTORY`: **Required.** Determines where Prism CLI commands are run from.
* `PRISMATIC_URL`: Optional. `https://app.prismatic.io` by default.
* `PRISM_PATH`: Optional. For pointing to a specific installation of `prism`.
* `TOOLSETS`: Optional. Specify the development toolsets you'd like to use -- `integration`, `component`, or by default all tools. Being selective about what tools to register may improve performance.

### With Claude Desktop or Claude Code

To use this MCP server with Claude Code, add the above config to your working directory's `.mcp.json` configuration file. For Claude Desktop, you'll add this to your `claude_desktop_config.json` file.

### With Cursor

You can configure available MCP Servers via `Cursor Settings` > `MCP Tools`, then add the above config to your `mcp.json` file.
