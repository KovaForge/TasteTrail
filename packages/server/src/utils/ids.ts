import crypto from "node:crypto";

export function generateId() {
  return crypto.randomUUID();
}

export function generateCorrelationId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
