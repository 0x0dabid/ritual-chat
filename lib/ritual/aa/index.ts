import { MOCK_MODE } from "@/lib/config";
import { MockAAProviderAdapter } from "@/lib/ritual/aa/mockAAProvider";
import { RealAAProviderAdapter } from "@/lib/ritual/aa/realAAProvider";
import type { AAProviderAdapter } from "@/lib/ritual/aa/types";

export function getAAProviderAdapter(): AAProviderAdapter {
  return MOCK_MODE ? new MockAAProviderAdapter() : new RealAAProviderAdapter();
}
