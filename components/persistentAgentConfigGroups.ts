interface PersistentAgentConfigGroup {
  title: string;
  items: string[];
}

export const persistentAgentConfigGroups: PersistentAgentConfigGroup[] = [
  {
    title: "Executor",
    items: ["PERSISTENT_AGENT_EXECUTOR_ADDRESS"],
  },
  {
    title: "LLM",
    items: [
      "PERSISTENT_AGENT_LLM_PROVIDER",
      "PERSISTENT_AGENT_MODEL",
      "PERSISTENT_AGENT_LLM_API_KEY_REF",
    ],
  },
  {
    title: "Data Availability",
    items: [
      "PERSISTENT_AGENT_DA_PROVIDER",
      "PERSISTENT_AGENT_DA_PATH",
      "PERSISTENT_AGENT_DA_KEY_REF",
    ],
  },
  {
    title: "DKMS",
    items: ["PERSISTENT_AGENT_ENCRYPTED_SECRETS"],
  },
  {
    title: "Scheduler",
    items: ["PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION"],
  },
  {
    title: "Funding",
    items: [
      "PERSISTENT_AGENT_DKMS_FUNDING_WEI",
      "PERSISTENT_AGENT_SCHEDULER_FUNDING_WEI",
    ],
  },
];

export function groupPersistentAgentMissingConfig(missingConfig: string[] = []) {
  const missing = new Set(missingConfig);
  const grouped = persistentAgentConfigGroups
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) => missing.has(item)),
    }))
    .filter((group) => group.items.length > 0);

  const groupedItems = new Set(grouped.flatMap((group) => group.items));
  const uncategorized = missingConfig.filter((item) => !groupedItems.has(item));

  if (uncategorized.length > 0) {
    grouped.push({
      title: "Other",
      items: uncategorized,
    });
  }

  return grouped;
}
