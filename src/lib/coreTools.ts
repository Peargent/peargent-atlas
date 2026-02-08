/**
 * Peargent Core Tools Metadata
 * These tools are built into Peargent and don't require custom implementation in Atlas.
 * Atlas only needs to reference them by name in the .pear file.
 * The generated Python code imports them from peargent.tools at runtime.
 */

export interface CoreTool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  importName: string;
  icon?: string;
}

export const CORE_TOOLS: CoreTool[] = [
  {
    id: "calculator",
    name: "calculator",
    displayName: "Calculator",
    description: "Perform mathematical calculations and solve equations",
    category: "Utility",
    importName: "calculator",
  },
  {
    id: "extract_text",
    name: "extract_text",
    displayName: "Text Extraction",
    description: "Extract plain text from HTML, PDF, DOCX, TXT, and Markdown files or URLs. Optionally extracts metadata like title, author, and page count.",
    category: "Document Processing",
    importName: "text_extractor",
  },
  {
    id: "search_wikipedia",
    name: "search_wikipedia",
    displayName: "Wikipedia Search",
    description: "Search Wikipedia articles with fuzzy matching and extract summaries, related links, and categories. Supports multiple languages and handles disambiguation pages.",
    category: "Search",
    importName: "wikipedia_tool",
  },
  {
    id: "send_notification",
    name: "send_notification",
    displayName: "Email",
    description: "Send email notifications via SMTP or Resend API. Supports template variables (Jinja2 or {variable}), plain text/HTML emails, and multi-provider fallback.",
    category: "Communication",
    importName: "email_tool",
  },
  {
    id: "send_discord_message",
    name: "send_discord_message",
    displayName: "Discord",
    description: "Send messages and rich embeds to Discord channels via webhooks. Supports template variables, custom fields, images, usernames, and avatars.",
    category: "Communication",
    importName: "discord_tool",
  },
  {
    id: "datetime_operations",
    name: "datetime_operations",
    displayName: "Date & Time",
    description: "Work with dates, times, and timezones. Get current time, calculate time differences, parse dates in multiple formats, and convert across IANA timezones.",
    category: "Utility",
    importName: "datetime_tool",
  },
  {
    id: "web_search",
    name: "web_search",
    displayName: "Web Search",
    description: "Search the web using DuckDuckGo for up-to-date information. Get results with titles, snippets, and URLs. Supports regional filtering, safe search, and time-based filtering.",
    category: "Search",
    importName: "websearch_tool",
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
 * Get core tool options for dropdown (with short labels)
 */
export function getCoreToolOptions() {
  return CORE_TOOLS.map((tool) => ({
    value: tool.name,
    label: tool.displayName,
    description: tool.description, // For tooltip
  }));
}
