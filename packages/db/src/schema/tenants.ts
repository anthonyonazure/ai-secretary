import { pgTable, uuid, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';

export const regionEnum = pgEnum('region', ['us', 'eu']);
export const tenantPlanEnum = pgEnum('tenant_plan', ['trial', 'starter', 'professional', 'enterprise']);

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  region: regionEnum('region').notNull(),
  plan: tenantPlanEnum('plan').notNull().default('trial'),
  /** HIPAA / GDPR / etc. compliance posture flags — drives provider routing in llm-gateway. */
  compliancePosture: jsonb('compliance_posture').notNull().$type<{
    hipaa?: boolean;
    bookGdpr?: boolean;
    customManagedKeys?: boolean;
    allowedLlmProviders?: Array<'anthropic' | 'openai' | 'azure-openai' | 'bedrock' | 'ollama'>;
  }>().default({}),
  /** Customer-managed KMS key ARN, when enabled. */
  kmsKeyArn: text('kms_key_arn'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
