// Re-export every schema module so consumers can `import { meetings } from '@ai-secretary/db/schema'`.
// Add new tables by creating a file in this folder and re-exporting here.

export * from './tenants.js';
export * from './users.js';
export * from './meetings.js';
