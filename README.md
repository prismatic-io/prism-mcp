<div align="center">
  <img src="https://prismatic.io/favicon-48x48.png" />
  <h1>@prismatic-io/prism-mcp</h1>
</div>

**Prism MCP Server** is a local Model Context Protocol (MCP) server that helps AI assistants work with the Prismatic API for code-native integration and custom component development.

> **Preview Feature**
>
> `prism-mcp` is currently in development and may change in future releases.

## Features

This MCP server provides several tools, organized into categories. You may register whatever set of tools are most relevant to your use case.

### General Tools (Always Available)

- **prism_me**: Check login status and display current user profile information
- **prism_components_list**: List all available components with version options

### Integration Tools (Toolset: "integration")

#### Utilities

- **prism_integrations_list**: List all integrations
- **prism_integrations_init**: Initialize a new Code Native Integration
- **prism_integrations_convert**: Convert a Low-Code Integration's YAML file to Code Native
- **prism_integrations_flows_list**: List flows for an integration
- **prism_integrations_flows_test**: Test a flow in an integration
- **prism_integrations_import**: Import an integration from a specific directory

#### Codegen

- **prism_install_component_manifest**: Generate component manifest in CNI src directory (requires spectral@10.6.0 or greater)
- **prism_install_legacy_component_manifest**: Generate line to add to a CNI's devDependencies for legacy component manifest installation
- **prism_integrations_generate_flow**: Generate boilerplate file for a CNI flow
- **prism_integrations_generate_config_page**: Generate boilerplate code for a CNI config page
- **prism_integrations_generate_config_var**: Generate boilerplate code for a config variable
- **prism_integrations_add_connection_config_var**: Returns path to connection wrapper function if available, otherwise generates boilerplate code for a connection config variable
- **prism_integrations_add_datasource_config_var**: Returns path to datasource wrapper function if available, otherwise generates boilerplate code for a datasource config variable

### Component Tools (Toolset: "component")

- **prism_components_init**: Initialize a new Component (supports WSDL/OpenAPI generation)
- **prism_components_publish**: Publish a component from a specific directory
- **prism_components_generate_manifest**: Generate the manifest for a Prismatic component

### Toolset Configuration

Tools are organized into **toolsets** that can be selectively enabled via the `TOOLSETS` environment variable:

- **`integration`** - Enables all integration-related tools
- **`component`** - Enables all component-related tools
- **General tools** are always available regardless of toolset configuration

If no `TOOLSETS` environment variable is set, all tools are registered by default.

## Prerequisites

1. Install the Prism CLI globally:

   ```bash
   npm install --global @prismatic-io/prism
   ```

2. Authenticate with Prismatic:
   ```bash
   prism login
   ```

## Usage

### Config

Configuration location and methods vary slightly depending on the AI tool you are using, but the following is relatively standard. More specific instructions are below.

Example setup:

```json
{
  "mcpServers": {
    "prism": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@prismatic-io/prism-mcp",
        "/path/to/the/work/dir/"
      ],
      "env": {}
    }
  }
}
```

Replace the path args as needed.

Command-line arguments:

- First argument: **Required.** Working directory path that determines where Prism CLI commands are run from.
- Remaining arguments: **Optional.** Toolsets to enable (`integration`, `component`). If no toolsets are specified, all tools are registered by default. Being selective about toolsets may improve performance.

Optional environment variable options:

- `PRISMATIC_URL`: `https://app.prismatic.io` by default.

### With Claude Desktop or Claude Code

To use this MCP server with Claude Code, add the above config to your working directory's `.mcp.json` configuration file. For Claude Desktop, you'll add this to your `claude_desktop_config.json` file.

### With Cursor

You can configure available MCP Servers via `Cursor Settings` > `MCP Tools`, then add the above config to your `mcp.json` file.

### With VS Code / GitHub Copilot

Add the above config to the `.vscode/mcp.json` in your workspace, or the global `mcp.json` file (accessible via the "Add MCP Server..." option in the Command Palette).

### Other tools

If your agent of choice is not listed, please reference their official documentation for setup instructions.

## What is Prismatic?

Prismatic is the leading embedded iPaaS, enabling B2B SaaS teams to ship product integrations faster and with less dev time. The only embedded iPaaS that empowers both developers and non-developers with tools for the complete integration lifecycle, Prismatic includes low-code and code-native building options, deployment and management tooling, and self-serve customer tools.

Prismatic's unparalleled versatility lets teams deliver any integration from simple to complex in one powerful platform. SaaS companies worldwide, from startups to Fortune 500s, trust Prismatic to help connect their products to the other products their customers use.

With Prismatic, you can:

- Build [integrations](https://prismatic.io/docs/integrations/) using our [intuitive low-code designer](https://prismatic.io/docs/integrations/low-code-integration-designer/) or [code-native](https://prismatic.io/docs/integrations/code-native/) approach in your preferred IDE
- Leverage pre-built [connectors](https://prismatic.io/docs/components/) for common integration tasks, or develop custom connectors using our TypeScript SDK
- Embed a native [integration marketplace](https://prismatic.io/docs/embed/) in your product for customer self-service
- Configure and deploy customer-specific integration instances with powerful configuration tools
- Support customers efficiently with comprehensive [logging, monitoring, and alerting](https://prismatic.io/docs/monitor-instances/)
- Run integrations in a secure, scalable infrastructure designed for B2B SaaS
- Customize the platform to fit your product, industry, and development workflows

## Who uses Prismatic?

Prismatic is built for B2B software companies that need to provide integrations to their customers. Whether you're a growing SaaS startup or an established enterprise, Prismatic's platform scales with your integration needs.

Our platform is particularly powerful for teams serving specialized vertical markets. We provide the flexibility and tools to build exactly the integrations your customers need, regardless of the systems you're connecting to or how unique your integration requirements may be.

## What kind of integrations can you build using Prismatic?

Prismatic supports integrations of any complexity - from simple data syncs to sophisticated, industry-specific solutions. Teams use it to build integrations between any type of system, whether modern SaaS or legacy with standard or custom protocols. Here are some example use cases:

- Connect your product with customers' ERPs, CRMs, and other business systems
- Process data from multiple sources with customer-specific transformation requirements
- Automate workflows with customizable triggers, actions, and schedules
- Handle complex authentication flows and data mapping scenarios

For information on the Prismatic platform, check out our [website](https://prismatic.io/) and [docs](https://prismatic.io/docs/).

## License

This repository is MIT licensed.
