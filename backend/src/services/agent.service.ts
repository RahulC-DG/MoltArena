import { PrismaClient, Agent } from '@prisma/client';
import { sanitizeInput } from '../utils/sanitize';
import { createApiKey } from './auth.service';

const prisma = new PrismaClient();

export interface CreateAgentData {
  name: string;
  displayName: string;
  description?: string;
}

export interface UpdateAgentData {
  displayName?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Register a new agent
 * Security: Uses Prisma (no raw SQL), sanitizes all inputs with DOMPurify
 */
export async function registerAgent(data: CreateAgentData): Promise<{
  agent: Agent;
  apiKey: string; // Plain API key (only returned once!)
}> {
  // Sanitize all user inputs
  const sanitizedName = sanitizeInput(data.name);
  const sanitizedDisplayName = sanitizeInput(data.displayName);
  const sanitizedDescription = data.description
    ? sanitizeInput(data.description)
    : undefined;

  // Validate name format (alphanumeric, hyphens, underscores only)
  const nameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  if (!nameRegex.test(sanitizedName)) {
    throw new Error(
      'Invalid name format. Use 3-50 alphanumeric characters, hyphens, or underscores.'
    );
  }

  // Validate displayName length
  if (sanitizedDisplayName.length < 1 || sanitizedDisplayName.length > 100) {
    throw new Error('Display name must be 1-100 characters');
  }

  // Validate description length if provided
  if (sanitizedDescription && sanitizedDescription.length > 500) {
    throw new Error('Description must be max 500 characters');
  }

  // Generate API key and hash
  const { apiKey, apiKeyHash } = await createApiKey();

  // Create agent in database using Prisma
  const agent = await prisma.agent.create({
    data: {
      name: sanitizedName,
      displayName: sanitizedDisplayName,
      description: sanitizedDescription,
      apiKeyHash,
    },
  });

  // Return agent and plain API key (this is the ONLY time the key is returned)
  return { agent, apiKey };
}

/**
 * Get agent by ID
 * Security: Uses Prisma (no raw SQL)
 */
export async function getAgentById(agentId: string): Promise<Agent | null> {
  return prisma.agent.findUnique({
    where: { id: agentId },
  });
}

/**
 * Get agent by name
 * Security: Uses Prisma (no raw SQL)
 */
export async function getAgentByName(name: string): Promise<Agent | null> {
  return prisma.agent.findUnique({
    where: { name },
  });
}

/**
 * Update agent profile
 * Security: Uses Prisma (no raw SQL), sanitizes all inputs
 */
export async function updateAgent(
  agentId: string,
  data: UpdateAgentData
): Promise<Agent> {
  // Sanitize inputs
  const sanitizedData: any = {};

  if (data.displayName !== undefined) {
    sanitizedData.displayName = sanitizeInput(data.displayName);
    if (sanitizedData.displayName.length < 1 || sanitizedData.displayName.length > 100) {
      throw new Error('Display name must be 1-100 characters');
    }
  }

  if (data.description !== undefined) {
    sanitizedData.description = data.description
      ? sanitizeInput(data.description)
      : null;
    if (sanitizedData.description && sanitizedData.description.length > 500) {
      throw new Error('Description must be max 500 characters');
    }
  }

  if (data.isActive !== undefined) {
    sanitizedData.isActive = data.isActive;
  }

  // Update agent using Prisma
  return prisma.agent.update({
    where: { id: agentId },
    data: sanitizedData,
  });
}
