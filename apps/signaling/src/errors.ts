import type { ContractError, ErrorCode } from "@conference/contracts";

export class SignalingError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function toContractError(error: unknown): ContractError {
  if (error instanceof SignalingError) {
    return { code: error.code, message: error.message };
  }

  return { code: "MEDIASOUP_ERROR", message: "Signaling operation failed" };
}
