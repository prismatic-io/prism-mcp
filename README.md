# Prism MCP Server

An MCP (Model Context Protocol) server that wraps Prismatic's Prism CLI tool, allowing AI assistants to interact with Prismatic integrations directly.

## Features

This MCP server provides the following tools:

- **prism_login**: Authenticate with Prismatic using email and password
- **prism_logout**: Log out of Prismatic
- **prism_me**: Check login status and display current user profile information
- **prism_integrations_list**: List all integrations with filtering options
- **prism_integrations_init**: Initialize a new Code Native Integration
- **prism_integrations_convert**: Convert a Low-Code Integration's YAML file to Code Native
- **prism_integrations_flows_list**: List flows for an integration
- **prism_integrations_flows_test**: Test a flow in an integration
- **prism_components_list**: List all available components with version options
- **prism_components_init**: Initialize a new Component (supports WSDL/OpenAPI generation)

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

### Configuration

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

Environment variable options:

* `WORKING_DIRECTORY`: Required. Determines where Prism CLI commands are run from.
* `PRISMATIC_URL`: Optional. `https://app.prismatic.io` by default.
* `PRISM_PATH`: Optional. For pointing to a specific installation of `prism`.

### With Claude Desktop or Claude Code

To use this MCP server with Claude Code, add the above config to your working directory's `.mcp.json` configuration file. For Claude Desktop, you'll add this to your `claude_desktop_config.json` file.

### With Cursor

You can configure available MCP Servers via `Cursor Settings` > `MCP Tools`, then add the above config to your `mcp.json` file.

## Available Tools

### prism_components_init
Initialize a new Component.
- Required parameter:
  - `name` (string) - Name of the component
- Optional parameters:
  - `directory` (string) - Directory to create the component in
  - `wsdlPath` (string) - Path to WSDL definition file for generation
  - `openApiPath` (string) - Path to OpenAPI Specification file for generation

### prism_components_list
List all components available in your organization.

### prism_integrations_convert
Convert a Low-Code Integration's YAML file into a Code Native Integration.
- Required parameter: `yamlFile` (string) - Path to a Low-Code Integration's YAML file
- Optional parameters:
  - `folder` (string) - Folder name to install the integration (defaults to kebab-cased integration name)
  - `registryPrefix` (string) - Custom NPM registry prefix

### prism_integrations_flows_list
List flows for an integration.
- Required parameter: `integrationId` (string) - Integration ID to list flows for
- Optional parameters:
  - `columns` (string) - Comma-separated list of columns to display

### prism_integrations_flows_test
Test a flow in an integration. Provide either flowUrl OR (flowId/flowName + integrationId).
- Parameters:
  - `flowUrl` (string) - Direct invocation URL of the flow
  - `flowId` (string) - Flow ID (requires integrationId)
  - `flowName` (string) - Flow name (requires integrationId)
  - `integrationId` (string) - Integration ID (required when using flowId or flowName)
  - `payload` (string) - Path to file containing the payload
  - `payloadContentType` (string) - Content type for the test payload
  - `sync` (boolean) - Force synchronous execution
  - `tailLogs` (boolean) - Tail logs from the execution
  - `tailResults` (boolean) - Tail step results
  - `timeout` (number) - Timeout in seconds for tailing
  - `resultFile` (string) - File to output results to

### prism_integrations_init
Initialize a new Code Native Integration.
- Required parameter: `name` (string) - Name of the integration (alphanumeric, hyphens, underscores)
- Optional parameter: `directory` (string) - Directory to create the integration in

### prism_integrations_list
List all integrations in your organization.
- Optional parameters:
  - `showAllVersions` (boolean) - Show all integration versions
  - `customer` (string) - Filter by customer
  - `org-only` (boolean) - Show only organization integrations

### prism_login
Authenticate with Prismatic.
- Required parameters:
  - `email` (string) - Your Prismatic account email
  - `password` (string) - Your Prismatic account password

### prism_logout
Log out of Prismatic. No parameters required.

### prism_me
Check login status and display current user profile information. No parameters required.

## License

MIT