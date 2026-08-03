import { createHash } from "node:crypto";

export const CREATE_WORK_ITEM_SCOPE = "create_work_item_with_actions";
export const MAX_OPERATION_ID_LENGTH = 256;

export type IdempotencyErrorCode =
  | "OPERATION_ID_REQUIRED"
  | "OPERATION_ID_INVALID"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD"
  | "IDEMPOTENCY_OPERATION_IN_PROGRESS";

export class IdempotencyError extends Error {
  constructor(
    public readonly code: IdempotencyErrorCode,
    public readonly status: 400 | 409,
    message: string,
  ) {
    super(message);
    this.name = "IdempotencyError";
  }
}

function normalizeOperationId(value: unknown, source: string) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new IdempotencyError(
      "OPERATION_ID_INVALID",
      400,
      `${source} must be a string`,
    );
  }

  const operationId = value.trim();
  if (!operationId) return null;
  if (operationId.length > MAX_OPERATION_ID_LENGTH) {
    throw new IdempotencyError(
      "OPERATION_ID_INVALID",
      400,
      `${source} exceeds the maximum length of ${MAX_OPERATION_ID_LENGTH}`,
    );
  }
  return operationId;
}

export function resolveOperationId(
  input: Record<string, unknown>,
  idempotencyKeyHeader?: string | null,
) {
  const sources = [
    ["input.operationId", input.operationId],
    ["input.operation_id", input.operation_id],
    ["Idempotency-Key", idempotencyKeyHeader],
  ] as const;
  const values: Array<{ source: string; value: string }> = [];
  for (const [source, value] of sources) {
    const normalized = normalizeOperationId(value, source);
    if (normalized) values.push({ source, value: normalized });
  }

  if (values.length === 0) {
    throw new IdempotencyError(
      "OPERATION_ID_REQUIRED",
      400,
      "operationId is required for create_work_item_with_actions",
    );
  }

  const operationId = values[0].value;
  if (values.some((entry) => entry.value !== operationId)) {
    throw new IdempotencyError(
      "IDEMPOTENCY_KEY_CONFLICT",
      409,
      "operationId sources must contain the same value",
    );
  }

  return operationId;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function canonicalRequestHash(value: unknown) {
  const canonicalJson = JSON.stringify(canonicalize(value));
  return createHash("sha256").update(canonicalJson).digest("hex");
}

export function isIdempotencyError(error: unknown): error is IdempotencyError {
  return error instanceof IdempotencyError;
}
