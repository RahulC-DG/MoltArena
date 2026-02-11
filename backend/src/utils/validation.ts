import { validate as uuidValidate } from 'uuid';
import { sanitizeInput } from './sanitize';

/**
 * Validation utilities for WebSocket event payloads
 * Security: Validates UUID format, length constraints, and sanitizes strings
 */

/**
 * Validate UUID format
 */
export function isValidUUID(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return uuidValidate(value);
}

/**
 * Validate and sanitize string with length constraints
 */
export function validateString(
  value: unknown,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    fieldName?: string;
  } = {}
): { valid: boolean; value?: string; error?: string } {
  const { required = false, minLength = 0, maxLength = Infinity, fieldName = 'field' } = options;

  // Check if value exists
  if (value === undefined || value === null) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, value: undefined };
  }

  // Check type
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  // Sanitize
  const sanitized = sanitizeInput(value);

  // Check length
  if (sanitized.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`,
    };
  }

  if (sanitized.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be at most ${maxLength} characters`,
    };
  }

  return { valid: true, value: sanitized };
}

/**
 * Validate battle:join event payload
 */
export function validateBattleJoinPayload(payload: unknown): {
  valid: boolean;
  battleId?: string;
  error?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  const { battleId } = payload as any;

  if (!isValidUUID(battleId)) {
    return { valid: false, error: 'Invalid battleId format (must be UUID)' };
  }

  return { valid: true, battleId };
}

/**
 * Validate battle:leave event payload
 */
export function validateBattleLeavePayload(payload: unknown): {
  valid: boolean;
  battleId?: string;
  error?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  const { battleId } = payload as any;

  if (!isValidUUID(battleId)) {
    return { valid: false, error: 'Invalid battleId format (must be UUID)' };
  }

  return { valid: true, battleId };
}

/**
 * Validate battle:submit_turn event payload
 */
export function validateSubmitTurnPayload(payload: unknown): {
  valid: boolean;
  battleId?: string;
  content?: string;
  error?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  const { battleId, content } = payload as any;

  // Validate battleId
  if (!isValidUUID(battleId)) {
    return { valid: false, error: 'Invalid battleId format (must be UUID)' };
  }

  // Validate content if provided
  if (content !== undefined) {
    const contentValidation = validateString(content, {
      required: false,
      maxLength: 5000,
      fieldName: 'content',
    });

    if (!contentValidation.valid) {
      return { valid: false, error: contentValidation.error };
    }

    return { valid: true, battleId, content: contentValidation.value };
  }

  return { valid: true, battleId };
}

/**
 * Validate battle:vote event payload
 */
export function validateVotePayload(payload: unknown): {
  valid: boolean;
  battleId?: string;
  agentId?: string;
  error?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  const { battleId, agentId } = payload as any;

  // Validate battleId
  if (!isValidUUID(battleId)) {
    return { valid: false, error: 'Invalid battleId format (must be UUID)' };
  }

  // Validate agentId
  if (!isValidUUID(agentId)) {
    return { valid: false, error: 'Invalid agentId format (must be UUID)' };
  }

  return { valid: true, battleId, agentId };
}
