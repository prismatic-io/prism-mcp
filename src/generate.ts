import { camelCase, kebabCase } from "lodash-es";
import { existsSync } from "node:fs";

export function generateFlowFile(name: string, description?: string): string {
  return `
import { flow } from "@prismatic-io/spectral";

export const ${camelCase(name)} = flow({
  name: "${name}",
  stableKey: "${kebabCase(name)}",
  description: "${description}",
  onTrigger: async (context, payload, params) => {
    // Put your logic here, use a component trigger, or remove this
    // value entirely to use the default webhook trigger.
    return Promise.resolve({ payload });
  },
  onExecution: async (context, params) => {
    // Put your logic here.
    return { data: null };
  },
});

export default ${camelCase(name)};
`;
}

export function generateConfigPage(name: string): string {
  return `
${name}: configPage({
  elements: {},
}),
`;
}

export function generateConfigVar(name: string, dataType: string, description?: string): string {
  return `
"${name}": configVar({
  stableKey: "${kebabCase(name)}",
  dataType: "${dataType}",
  description: "${description}",
}),
`;
}

export function generateConnectionConfigVar(
  name: string,
  componentRef?: { componentKey: string; connectionKey: string },
  directory?: string,
): string {
  const isComponentRef = componentRef?.componentKey;
  if (isComponentRef) {
    const connectionPath = `${directory}/src/manifests/${componentRef.componentKey}/connections/`;
    const manifestInSrc = existsSync(connectionPath);

    if (manifestInSrc) {
      return connectionPath;
    }

    return `
"${name}": connectionConfigVar({
  stableKey: "${kebabCase(name)}",
  dataType: "connection",
  connection: {
    component: "${componentRef.componentKey}",
    key: "${componentRef.connectionKey}",
    values: {
      // Fill according to type hinting.
    },
  },
}),
`;
  } else {
    return `
"${name}": connectionConfigVar({
  stableKey: "${kebabCase(name)}",
  dataType: "connection",
  inputs: {
    // Fill as needed.
  },
}),
`;
  }
}

export function generateDataSourceConfigVar(
  name: string,
  dataType: string,
  componentRef?: { componentKey: string; dataSourceKey: string },
  directory?: string,
): string {
  const isComponentRef = componentRef?.componentKey;
  if (isComponentRef) {
    const dataSourcePath = `${directory}/src/manifests/${componentRef.componentKey}/dataSources/`;
    const manifestInSrc = existsSync(dataSourcePath);

    if (manifestInSrc) {
      return dataSourcePath;
    }

    return `
"${name}": dataSourceConfigVar({
  stableKey: "${kebabCase(name)}",
  dataType: "${dataType}",
  dataSource: {
    component: "${componentRef.componentKey}",
    key: "${componentRef.dataSourceKey}",
    values: {
      // Populate values according to the provided component types.
      // You may need to ensure that the ${componentRef.componentKey} component-manifest is installed.
    },
  },
}),
`;
  } else {
    return `
"${name}": dataSourceConfigVar({
  dataSourceType: "${dataType}",
  stableKey: "${kebabCase(name)}",
  perform: async (context, params) => {
    return { result: [ /* replace this with a result fitting the dataSourceType */ ] };
  },
}),
`;
  }
}
