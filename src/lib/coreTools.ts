/**
 * Peargent Core Tools Metadata
 * These tools are built into Peargent and don't require custom implementation in Atlas.
 * Atlas only needs to reference them by name in the .pear file.
 * The Peargent serializer handles importing and instantiation.
 */

export interface CoreTool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon?: string;
}

export const CORE_TOOLS: CoreTool[] = [
  {
    id: "calculator",
    name: "calculator",
    displayName: "Calculator",
    description: "Perform mathematical calculations and solve equations",
    category: "Utility",
    icon: "🧮",
  },
  {
    id: "extract_text",
    name: "extract_text",
    displayName: "Text Extraction",
    description: "Extract text from PDF, HTML, DOCX, and TXT files",
    category: "Document Processing",
    icon: "📄",
  },
  {
    id: "search_wikipedia",
    name: "search_wikipedia",
    displayName: "Wikipedia Search",
    description: "Search Wikipedia for encyclopedic knowledge",
    category: "Search",
    icon: "📚",
  },
  {
    id: "send_notification",
    name: "send_notification",
    displayName: "Email",
    description: "Send email notifications via SMTP",
    category: "Communication",
    icon: "📧",
  },
  {
    id: "send_discord_message",
    name: "send_discord_message",
    displayName: "Discord",
    description: "Send messages to Discord channels",
    category: "Communication",
    icon: "💬",
  },
  {
    id: "datetime_operations",
    name: "datetime_operations",
    displayName: "Date & Time",
    description:
      "Get current date and time, parse dates, calculate time differences",
    category: "Utility",
    icon: "🕐",
  },
  {
    id: "web_search",
    name: "web_search",
    displayName: "Web Search",
    description: "Search the web for information",
    category: "Search",
    icon: "🔍",
  },
];

/**
 * Get core tool by name
 */
export function getCoreToolByName(name: string): CoreTool | undefined {
  return CORE_TOOLS.find((tool) => tool.name === name);
}

/**
 * Check if a tool name is a core tool
 */
export function isCoreTool(name: string): boolean {
  return CORE_TOOLS.some((tool) => tool.name === name);
}

/**
 * Get core tool options for dropdown
 */
export function getCoreToolOptions() {
  return CORE_TOOLS.map((tool) => ({
    value: tool.name,
    label: `${tool.displayName} - ${tool.description}`,
  }));
}
