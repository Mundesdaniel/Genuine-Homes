/**
 * Property ↔ agent assignment contracts. A property owner (typically a manager
 * running a multi-unit apartment) can assign agents to help handle the property's
 * units/tenants. Assigned agents receive and can act on its viewing requests.
 */

import { z } from 'zod';
import type { UserRole } from '../enums';

/** Assign an agent to a property by their email or phone (no public directory). */
export const assignAgentSchema = z.object({
  emailOrPhone: z.string().trim().min(3, 'Enter the agent’s email or phone'),
});
export type AssignAgentInput = z.infer<typeof assignAgentSchema>;

/** An agent assigned to a property, as shown to the owner. */
export interface ManagedAgentResponse {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: UserRole;
  assignedAt: string;
}
