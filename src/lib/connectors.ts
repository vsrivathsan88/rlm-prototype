export function normalizeConnectorProvider(connector: string | null | undefined): string | null {
  if (!connector) return null;
  const value = connector.toLowerCase();
  if (value === "gdrive" || value === "google drive") return "gdrive";
  if (value === "local" || value === "local folder") return "local";
  return value;
}

export function connectorLabel(connector: string | null | undefined): string {
  const normalized = normalizeConnectorProvider(connector);
  if (!normalized) return "Unknown";
  if (normalized === "gdrive") return "Google Drive";
  if (normalized === "local") return "Local Folder";
  return normalized;
}
