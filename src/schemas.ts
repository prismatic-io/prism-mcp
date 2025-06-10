import { z } from "zod/v4";

// Base schemas
export const EmptyArgsSchema = z.object({});

// Auth schemas
export const LoginArgsSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export const SetUrlArgsSchema = z.object({
  url: z.url().describe("Prismatic URL to use for CLI operations"),
});

// Integration schemas
export const IntegrationInitArgsSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric with hyphens and underscores only").describe("Name of the integration (alphanumeric, hyphens, underscores)"),
  directory: z.string().optional(),
});

export const IntegrationConvertArgsSchema = z.object({
  yamlFile: z.string().min(1),
  folder: z.string().optional(),
  registryPrefix: z.string().optional(),
});

// Component schemas
export const ComponentInitArgsSchema = z.object({
  name: z.string().min(1),
  directory: z.string().optional(),
  wsdlPath: z.string().optional(),
  openApiPath: z.string().optional(),
});

// Flow schemas
export const FlowListArgsSchema = z.object({
  integrationId: z.string().min(1),
  columns: z.string().optional(),
});

export const FlowTestArgsSchema = z.object({
  flowUrl: z.url().optional(),
  flowId: z.string().optional(),
  flowName: z.string().optional(),
  integrationId: z.string().optional(),
  payload: z.string().optional(),
  payloadContentType: z.string().optional(),
  sync: z.boolean().optional(),
  tailLogs: z.boolean().optional(),
  tailResults: z.boolean().optional(),
  timeout: z.number().positive().optional().describe("Maximum time to tail for logs and step results (in seconds)."),
  resultFile: z.string().optional(),
});

// Type exports
export type EmptyArgs = z.infer<typeof EmptyArgsSchema>;
export type LoginArgs = z.infer<typeof LoginArgsSchema>;
export type SetUrlArgs = z.infer<typeof SetUrlArgsSchema>;
export type IntegrationInitArgs = z.infer<typeof IntegrationInitArgsSchema>;
export type IntegrationConvertArgs = z.infer<typeof IntegrationConvertArgsSchema>;
export type ComponentInitArgs = z.infer<typeof ComponentInitArgsSchema>;
export type FlowListArgs = z.infer<typeof FlowListArgsSchema>;
export type FlowTestArgs = z.infer<typeof FlowTestArgsSchema>;
