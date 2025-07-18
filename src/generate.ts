import { camelCase, kebabCase } from "lodash-es";

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
    return { data: response.data };
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
  componentRef?: { component: string; key: string },
): string {
  const isComponentRef = componentRef?.component;
  if (isComponentRef) {
    return `
"${name}": connectionConfigVar({
  stableKey: "${kebabCase(name)}",
  dataType: "connection",
  connection: {
    component: "${componentRef.component}",
    key: "${componentRef.key}",
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
  componentRef?: { component: string; key: string },
): string {
  const isComponentRef = componentRef?.component;
  if (isComponentRef) {
    return `
"${name}": dataSourceConfigVar({
  stableKey: "${kebabCase(name)}",
  dataType: "${dataType}",
  dataSource: {
    component: "${componentRef.component}",
    key: "${componentRef.key}",
    values: {
      // Populate values according to the provided component types.
      // You may need to ensure that the ${componentRef.component} component-manifest is installed.
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
