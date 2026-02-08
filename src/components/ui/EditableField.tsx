"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import {
  ChevronDown,
  Maximize2,
  X,
  Minimize2,
  Sparkles,
  Loader2,
  Check,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/themes/prism-tomorrow.css"; // Dark theme for code

// Type definitions
export type FieldType = "text" | "textarea" | "number" | "select" | "boolean";

export interface SelectOption {
  value: string;
  label: string;
  description?: string; // For tooltip
}

export interface EditableFieldProps {
  label: string;
  value: any;
  type: FieldType;
  options?: SelectOption[]; // For select type
  onChange: (value: any) => void;
  icon?: any;
  placeholder?: string;
  color?: string; // Accent color class
  disabled?: boolean;
  mono?: boolean; // Monospace font
  expandable?: boolean; // Show in popup modal
  aiGeneration?: boolean; // Enable AI generation
  aiApiEndpoint?: string; // API endpoint for AI generation (default: /api/generate-function)
  aiResponseField?: string; // Field name in API response (default: 'code')
  onSuggestMetadata?: (name: string, description: string) => void; // Callback for name/description suggestions
  syntaxLanguage?: string; // Language for syntax highlighting (e.g., 'python')
}

// Boolean options for dropdown
const BOOLEAN_OPTIONS: SelectOption[] = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
  { value: "null", label: "Inherit (null)" },
];

// Debounce delay in ms
const DEBOUNCE_DELAY = 500;

export function EditableField({
  label,
  value,
  type,
  options,
  onChange,
  icon: Icon,
  placeholder,
  color = "text-primary",
  disabled = false,
  mono = false,
  expandable = false,
  aiGeneration = false,
  aiApiEndpoint = "/api/generate-function",
  aiResponseField = "code",
  onSuggestMetadata,
  syntaxLanguage,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Expanded modal state
  const [fontSize, setFontSize] = useState(15); // Font size state
  const [localValue, setLocalValue] = useState(value);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    name: string;
    description: string;
  } | null>(null);

  // For conversation continuity - persist in localStorage
  const storageKey = `ai-response-id-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const [aiResponseId, setAiResponseId] = useState<string | null>(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      return localStorage.getItem(storageKey);
    }
    return null;
  });

  // Persist aiResponseId to localStorage when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (aiResponseId) {
        localStorage.setItem(storageKey, aiResponseId);
      }
    }
  }, [aiResponseId, storageKey]);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for save-on-unmount
  const latestValueRef = useRef(localValue);
  const latestOnChangeRef = useRef(onChange);
  const hasChangedRef = useRef(false);

  // Update refs
  useEffect(() => {
    latestValueRef.current = localValue;
    latestOnChangeRef.current = onChange;
    if (localValue !== value) {
      hasChangedRef.current = true;
    }
  }, [localValue, value, onChange]);

  // Cleanup debounce timer AND save if dirty on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Save on unmount if changed
      if (hasChangedRef.current) {
        let finalValue: any = latestValueRef.current;
        // Basic conversion
        if (type === "number") {
          finalValue =
            finalValue === "" || finalValue === null
              ? null
              : Number(finalValue);
        } else if (type === "boolean") {
          if (finalValue === "true") finalValue = true;
          else if (finalValue === "false") finalValue = false;
          else if (finalValue === "null") finalValue = null;
        }
        latestOnChangeRef.current(finalValue);
      }
    };
  }, [type]);

  // Sync local value when prop changes (but only if it's genuinely different)
  useEffect(() => {
    // Only sync if the value prop is different from our local value
    // This prevents cursor reset when our own onChange triggers a prop update
    if (value !== localValue) {
      setLocalValue(value);
      hasChangedRef.current = false;
    }
  }, [value]); // Note: intentionally not including localValue to avoid loops

  // Focus input when entering edit mode (inline)
  useEffect(() => {
    if (isEditing && !isExpanded && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing, isExpanded]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear tooltip when dropdown closes
  useEffect(() => {
    if (!isDropdownOpen) {
      setHoveredOption(null);
      setTooltipPosition(null);
    }
  }, [isDropdownOpen]);

  // Debounced auto-save
  const handleInputChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        let finalValue: any = newValue;
        if (type === "number") {
          finalValue =
            newValue === "" || newValue === null ? null : Number(newValue);
        }
        onChange(finalValue);
      }, DEBOUNCE_DELAY);
    },
    [type, onChange],
  );

  const handleSave = useCallback(() => {
    let finalValue = localValue;
    if (type === "number") {
      finalValue =
        localValue === "" || localValue === null ? null : Number(localValue);
    } else if (type === "boolean") {
      if (localValue === "true") finalValue = true;
      else if (localValue === "false") finalValue = false;
      else finalValue = null;
    }
    onChange(finalValue);
    setIsEditing(false);
    setIsExpanded(false);
  }, [localValue, type, onChange]);

  const handleCancel = useCallback(() => {
    setLocalValue(value);
    setIsEditing(false);
    setIsExpanded(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && type !== "textarea") {
        handleSave();
      } else if (e.key === "Escape") {
        if (isExpanded) {
          // Expanded mode closes on Escape (and saves via auto-save logic usually, but better to force current value)
          // Or revert? User expects modal behavior. Escape usually cancels.
          // But we have auto-save.
          // Let's stick to auto-save behavior: Escape exits, current text is kept.
          setIsExpanded(false);
        } else {
          handleCancel(); // Inline escape cancels
        }
      }
    },
    [type, handleSave, handleCancel, isExpanded],
  );

  const handleSelectOption = useCallback(
    (optionValue: string) => {
      setLocalValue(optionValue);
      setIsDropdownOpen(false);
      setHoveredOption(null);
      setTooltipPosition(null);
      let finalValue: any = optionValue;
      if (type === "boolean") {
        if (optionValue === "true") finalValue = true;
        else if (optionValue === "false") finalValue = false;
        else finalValue = null;
      }
      onChange(finalValue);
    },
    [type, onChange],
  );

  const getDisplayValue = () => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "boolean") return value ? "True" : "False";
    if (type === "select" && options) {
      const opt = options.find((o) => o.value === String(value));
      return opt?.label || String(value);
    }
    return String(value);
  };

  // AI Generation handler
  const handleGenerateWithAI = useCallback(async () => {
    if (!aiPrompt.trim() || isGenerating) return;

    // Track if this is a first-time generation (no conversation history)
    const isFirstGeneration = !aiResponseId;

    // Extract current identifier for topic comparison
    // For functions: extract function name; For other content: extract keywords from text
    const currentValue = String(localValue || "");
    const functionNameMatch = currentValue.match(/^def\s+(\w+)/);
    const currentIdentifier = functionNameMatch
      ? functionNameMatch[1] // Function name for code
      : currentValue.substring(0, 100); // First 100 chars for text

    setIsGenerating(true);
    try {
      const response = await fetch(aiApiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          previousResponseId: aiResponseId, // Pass for continuity
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("AI Generation error:", data.error);
        return;
      }

      // Get the generated content from the response field
      const generatedContent = data[aiResponseField];
      if (generatedContent) {
        setLocalValue(generatedContent);
        onChange(generatedContent);
        setAiPrompt(""); // Clear prompt after successful generation
      }

      // Store response ID for follow-up requests
      if (data.responseId) {
        setAiResponseId(data.responseId);
      }

      // Show suggestion popup only on first generation OR if topic changed significantly
      if (
        data.suggestedName &&
        data.suggestedDescription &&
        onSuggestMetadata
      ) {
        const suggestedName = data.suggestedName;

        // Extract meaningful keywords (excluding common words)
        const commonWords = [
          "get",
          "set",
          "is",
          "has",
          "can",
          "do",
          "make",
          "create",
          "update",
          "delete",
          "fetch",
          "send",
          "check",
          "validate",
          "process",
          "handle",
          "calculate",
          "convert",
          "parse",
          "format",
          "find",
          "search",
          "load",
          "save",
          "read",
          "write",
          "you",
          "are",
          "the",
          "a",
          "an",
          "and",
          "or",
          "for",
          "with",
          "that",
          "this",
          "will",
          "your",
          "agent",
          "assistant",
        ];

        const extractKeywords = (name: string) => {
          return name
            .toLowerCase()
            .replace(/[^\w\s]/g, "") // Remove punctuation
            .split(/[_\s]+/)
            .filter((word) => word.length > 2 && !commonWords.includes(word));
        };

        const currentKeywords = extractKeywords(currentIdentifier);
        const suggestedKeywords = extractKeywords(suggestedName);

        // First generation always shows popup
        if (isFirstGeneration) {
          setSuggestion({
            name: data.suggestedName,
            description: data.suggestedDescription,
          });
        } else {
          // For follow-ups, only show if topic changed significantly
          const hasOverlap =
            currentKeywords.length === 0 ||
            suggestedKeywords.length === 0 ||
            currentKeywords.some((kw) =>
              suggestedKeywords.some(
                (skw) => skw.includes(kw) || kw.includes(skw),
              ),
            );

          if (!hasOverlap) {
            setSuggestion({
              name: data.suggestedName,
              description: data.suggestedDescription,
            });
          }
        }
      }
    } catch (error) {
      console.error("AI Generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [
    aiPrompt,
    isGenerating,
    onChange,
    aiResponseId,
    onSuggestMetadata,
    localValue,
    aiApiEndpoint,
    aiResponseField,
  ]);

  // Theme Classes
  const baseColor = color.replace("text-", "");
  const theme = {
    border: `border-${baseColor}/30`,
    focusBorder: `focus:border-${baseColor}`,
    hoverBorder: `hover:border-${baseColor}/50`,
    bgSoft: `bg-${baseColor}/10`,
    text: color,
  };

  // --- Expanded Modal (inline, not a component) ---
  // Compute theme colors for modal
  const modalBaseColor = color.replace("text-", "");
  const modalBorderColor = `border-${modalBaseColor}/30`;
  const modalAccentGlow = modalBaseColor.includes("blue")
    ? "shadow-blue-500/10"
    : modalBaseColor.includes("amber")
      ? "shadow-amber-500/10"
      : modalBaseColor.includes("purple")
        ? "shadow-purple-500/10"
        : modalBaseColor.includes("pink")
          ? "shadow-pink-500/10"
          : modalBaseColor.includes("emerald")
            ? "shadow-emerald-500/10"
            : "shadow-primary/10";

  // Calculate line count for line numbers
  const modalLines = String(localValue || "").split("\n");
  const modalLineCount = Math.max(modalLines.length, 10);

  // Render modal via portal (inline, not as component to preserve cursor)
  const expandedModalContent = isExpanded
    ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-200">
          <div
            className={cn(
              "w-full max-w-4xl h-[75vh] min-h-[450px] max-h-[800px] bg-card rounded-xl shadow-2xl flex flex-col overflow-hidden border",
              modalBorderColor,
              modalAccentGlow,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className={cn(
                "flex items-center justify-between px-5 py-3.5 border-b bg-muted/50",
                modalBorderColor,
              )}
            >
              <div className="flex items-center gap-3">
                {Icon && (
                  <div
                    className={cn("p-2 rounded-lg", `bg-${modalBaseColor}/10`)}
                  >
                    <Icon className={cn("w-4 h-4", color)} />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className={cn("font-semibold text-sm", color)}>
                    {label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                    Editor
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Zoom Controls */}
                <div className="flex items-center mr-2 border-r border-border/50 pr-2 gap-1">
                  <button
                    onClick={() =>
                      setFontSize((prev) => Math.max(10, prev - 1))
                    }
                    className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-all"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-muted-foreground w-6 text-center">
                    {fontSize}
                  </span>
                  <button
                    onClick={() =>
                      setFontSize((prev) => Math.min(24, prev + 1))
                    }
                    className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-all"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-all"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Area with Line Numbers */}
            <div className="flex-1 flex overflow-hidden bg-background">
              {/* Line Numbers */}
              {mono && (
                <div className="flex-shrink-0 w-12 bg-muted/30 border-r border-border/50 select-none overflow-hidden">
                  <div className="py-4 pr-3 text-right">
                    {Array.from({ length: modalLineCount }, (_, i) => (
                      <div
                        key={i}
                        className="text-muted-foreground/40 font-mono"
                        style={{
                          fontSize: `${Math.max(8, fontSize - 2)}px`,
                          lineHeight: `${fontSize * 1.8}px`,
                          height: `${fontSize * 1.6}px`,
                        }}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Editor */}
              <div
                className="flex-1 relative overflow-auto font-mono [&::-webkit-scrollbar]:hidden"
                style={{
                  lineHeight: `${fontSize * 1.6}px`,
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
                onScroll={(e) => {
                  if (lineNumbersRef.current) {
                    lineNumbersRef.current.scrollTop =
                      e.currentTarget.scrollTop;
                  }
                }}
              >
                {syntaxLanguage ? (
                  <Editor
                    value={localValue || ""}
                    onValueChange={(code) => handleInputChange(code)}
                    highlight={(code) =>
                      Prism.highlight(
                        code,
                        Prism.languages[syntaxLanguage] ||
                          Prism.languages.python,
                        syntaxLanguage || "python",
                      )
                    }
                    padding={16}
                    textareaId="code-editor-area"
                    className="w-full bg-transparent border-none focus:outline-none"
                    style={{
                      fontFamily: "inherit",
                      fontSize: `${fontSize}px`,
                      lineHeight: `${fontSize * 1.6}px`,
                      minHeight: "100%",
                    }}
                    textareaClassName="focus:outline-none"
                  />
                ) : (
                  <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    autoFocus
                    dir="ltr"
                    value={localValue || ""}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      placeholder ||
                      (mono ? "Enter your code here..." : "Start typing...")
                    }
                    spellCheck={!mono}
                    className={cn(
                      "w-full h-full p-4 bg-transparent border-none resize-none focus:ring-0 focus:outline-none",
                      "text-foreground/90 placeholder:text-muted-foreground/30",
                      "caret-primary text-left",
                      mono && "font-mono tracking-tight",
                      "[&::-webkit-scrollbar]:hidden",
                    )}
                    style={{
                      fontSize: `${fontSize}px`,
                      lineHeight: `${fontSize * 1.6}px`,
                      tabSize: 4,
                      MozTabSize: 4,
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                    }}
                  />
                )}

                {/* Compact Floating Suggestion Popup - Inside Editor */}
                {suggestion && onSuggestMetadata && (
                  <div className="absolute bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                    <div className="bg-background/95 backdrop-blur-sm border border-violet-500/30 rounded-xl shadow-xl shadow-violet-500/10 p-3 max-w-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs font-medium text-violet-400">
                          Update metadata?
                        </span>
                      </div>
                      <div className="space-y-1 text-xs mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-12">
                            Name:
                          </span>
                          <span className="font-mono text-violet-300 truncate">
                            {suggestion.name}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground w-12 shrink-0">
                            Desc:
                          </span>
                          <span className="text-foreground/70 line-clamp-2">
                            {suggestion.description}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSuggestion(null);
                            // Defer to next tick to avoid setState during render
                            setTimeout(() => {
                              onSuggestMetadata?.(
                                suggestion.name,
                                suggestion.description,
                              );
                            }, 0);
                          }}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/30 hover:to-fuchsia-500/30 text-violet-400 hover:text-violet-300 transition-colors text-xs font-medium flex items-center justify-center gap-1.5 border border-violet-500/20"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Apply
                        </button>
                        <button
                          onClick={() => setSuggestion(null)}
                          className="py-1.5 px-3 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Generation Prompt */}
            {aiGeneration && (
              <div
                className={cn(
                  "px-5 py-3 border-t bg-muted/20",
                  modalBorderColor,
                )}
              >
                <div className="relative flex flex-col md:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleGenerateWithAI();
                        }
                      }}
                      placeholder={
                        label === "Persona"
                          ? "Describe persona to generate..."
                          : "Describe function to generate..."
                      }
                      className={cn(
                        "w-full bg-background border rounded-lg px-4 py-2.5 text-sm outline-none transition-all",
                        "placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/20",
                        isGenerating ? "opacity-50 pointer-events-none" : "",
                        modalBorderColor,
                      )}
                    />
                    {isGenerating && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 w-full md:w-auto">
                    <button
                      onClick={handleGenerateWithAI}
                      disabled={isGenerating || !aiPrompt.trim()}
                      className={cn(
                        "flex-1 md:flex-none justify-center px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all",
                        "bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 hover:from-violet-500/20 hover:to-fuchsia-500/20",
                        "border border-violet-500/20 text-violet-400 hover:text-violet-300",
                        (isGenerating || !aiPrompt.trim()) &&
                          "opacity-50 cursor-not-allowed grayscale",
                      )}
                    >
                      <Sparkles className="w-4 h-4" />
                      {isGenerating ? "Generating..." : "Generate"}
                    </button>
                    <a
                      href={`https://chatgpt.com/?q=${encodeURIComponent(
                        label === "Persona"
                          ? `Generate an AI agent persona/system prompt that: ${aiPrompt || "is a helpful assistant"}. Return only the persona text, no explanations.`
                          : `Generate a Python function that: ${aiPrompt || "does something useful"}. Return only the function code starting with "def", no explanations or examples.`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex-1 md:flex-none justify-center px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all",
                        "bg-emerald-500/10 hover:bg-emerald-500/20",
                        "border border-emerald-500/20 text-emerald-400 hover:text-emerald-300",
                      )}
                      title="Generate with ChatGPT"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.0215 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4979 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
                      </svg>
                      ChatGPT
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Footer / Status Bar */}
            <div
              className={cn(
                "px-5 py-3 border-t bg-muted/30 flex justify-between items-center gap-4",
                modalBorderColor,
              )}
            >
              <div className="flex items-center gap-5 text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500/80"></span>
                  Auto-save
                </span>
                <span>{modalLines.length} lines</span>
                <span>{String(localValue || "").length} chars</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                <kbd className="px-2 py-1 rounded bg-secondary border border-border font-mono text-[11px]">
                  Esc
                </kbd>
                <span>to close</span>
              </div>
            </div>
          </div>

          {/* Backdrop click to close */}
          <div
            className="absolute inset-0 -z-10"
            onClick={() => setIsExpanded(false)}
          />
        </div>,
        document.body,
      )
    : null;

  // Render select/dropdown
  if (type === "select" || type === "boolean") {
    const selectOptions = type === "boolean" ? BOOLEAN_OPTIONS : options || [];
    const currentLabel =
      selectOptions.find(
        (o) =>
          o.value === String(value) ||
          (type === "boolean" &&
            o.value ===
              (value === true ? "true" : value === false ? "false" : "null")),
      )?.label || getDisplayValue();

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          {Icon && <Icon className="w-3 h-3 opacity-60" />}
          {label}
        </div>
        <div className="relative overflow-visible" ref={dropdownRef}>
          <button
            onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
            disabled={disabled}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all",
              "bg-secondary/50 border border-border hover:bg-secondary/70",
              theme.hoverBorder,
              disabled && "opacity-50 cursor-not-allowed",
              mono && "font-mono",
            )}
          >
            <span className="truncate">{currentLabel}</span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                isDropdownOpen && "rotate-180",
              )}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden max-h-[300px] overflow-y-auto">
              {selectOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelectOption(opt.value)}
                  onMouseEnter={(e) => {
                    if (opt.description) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredOption(opt.value);
                      setTooltipPosition({
                        top: rect.top,
                        left: rect.left,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredOption(null);
                    setTooltipPosition(null);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-sm text-left hover:bg-secondary/50 transition-colors",
                    (String(value) === opt.value ||
                      (type === "boolean" &&
                        opt.value ===
                          (value === true
                            ? "true"
                            : value === false
                              ? "false"
                              : "null"))) &&
                      cn(theme.bgSoft, theme.text),
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Tooltip for hovered option - rendered to the left */}
          {hoveredOption && tooltipPosition && typeof window !== "undefined" &&
            createPortal(
              <div
                className="fixed z-[9999] pointer-events-none"
                style={{
                  top: `${tooltipPosition.top}px`,
                  left: `${tooltipPosition.left - 16}px`,
                  transform: "translateX(-100%)",
                }}
              >
                <div className="bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl p-3 max-w-xs">
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {selectOptions.find((o) => o.value === hoveredOption)
                      ?.description}
                  </p>
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>
    );
  }

  // Render textarea
  if (type === "textarea") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {Icon && <Icon className="w-3 h-3 opacity-60" />}
            {label}
          </div>
        </div>

        {/* Main Interaction Area */}
        {expandable ? (
          <>
            <div
              onClick={() => !disabled && setIsExpanded(true)}
              className={cn(
                "group relative px-3 py-2 rounded-lg text-sm cursor-pointer transition-all min-h-[80px]",
                "bg-secondary/50 border border-transparent hover:bg-secondary/70",
                theme.hoverBorder,
                disabled && "cursor-default opacity-50",
                mono && "font-mono text-xs",
              )}
            >
              <div className="line-clamp-3 whitespace-pre-wrap break-words opacity-80 group-hover:opacity-100">
                {value || (
                  <span className="text-muted-foreground italic">
                    {placeholder || "Click to edit code..."}
                  </span>
                )}
              </div>

              {/* Expand Hint Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 rounded-lg pointer-events-none">
                <div className="bg-background/80 backdrop-blur px-2 py-1 rounded text-[10px] font-medium text-foreground border border-border flex items-center gap-1.5">
                  <Maximize2 className="w-3 h-3" />
                  Click into Editor
                </div>
              </div>
            </div>
            {expandedModalContent}
          </>
        ) : /* Existing Inline Logic for non-expandable */
        isEditing ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue || ""}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                handleCancel();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={4}
            className={cn(
              "w-full px-3 py-2 rounded-lg text-sm resize-y min-h-[80px]",
              "bg-secondary/50 border focus:outline-none",
              theme.border,
              theme.focusBorder,
              mono && "font-mono text-xs",
            )}
          />
        ) : (
          <div
            onClick={() => !disabled && setIsEditing(true)}
            className={cn(
              "px-3 py-2 rounded-lg text-sm cursor-pointer transition-all",
              "bg-secondary/50 border border-transparent hover:bg-secondary/70",
              theme.hoverBorder,
              "whitespace-pre-wrap break-words max-h-32 overflow-y-auto",
              disabled && "cursor-default opacity-50",
              mono && "font-mono text-xs",
            )}
            style={{ scrollbarWidth: "thin" }}
          >
            {value || (
              <span className="text-muted-foreground italic">
                {placeholder || "Click to edit..."}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Render text or number input
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
        {Icon && <Icon className="w-3 h-3 opacity-60" />}
        {label}
      </div>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === "number" ? "number" : "text"}
            value={localValue ?? ""}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            step={type === "number" ? "any" : undefined}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-lg text-sm",
              "bg-secondary/50 border focus:outline-none",
              theme.border,
              theme.focusBorder,
              mono && "font-mono",
            )}
          />
        </div>
      ) : (
        <div
          onClick={() => !disabled && setIsEditing(true)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all truncate",
            "bg-secondary/50 border border-transparent hover:bg-secondary/70",
            theme.hoverBorder,
            disabled && "cursor-default opacity-50",
            mono && "font-mono",
          )}
        >
          {getDisplayValue() || (
            <span className="text-muted-foreground italic">
              {placeholder || "Click to edit..."}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-configured option sets
export const FIELD_OPTIONS = {
  on_error: [
    { value: "raise", label: "Raise Exception" },
    { value: "return_error", label: "Return Error" },
    { value: "return_none", label: "Return None" },
  ],
  context_strategy: [
    { value: "smart", label: "Smart" },
    { value: "trim_last", label: "Trim Last" },
    { value: "trim_first", label: "Trim First" },
    { value: "summarize", label: "Summarize" },
    { value: "first_last", label: "First & Last" },
  ],
  store_type: [
    { value: "session_buffer", label: "Session Buffer" },
    { value: "file", label: "File System" },
    { value: "sqlite", label: "SQLite" },
    { value: "postgresql", label: "PostgreSQL" },
    { value: "redis", label: "Redis" },
  ],
  router_type: [
    { value: "routing_agent", label: "Routing Agent (AI)" },
    { value: "semantic_router", label: "Semantic Router (Embedding)" },
    { value: "round_robin", label: "Round Robin (Simple)" },
  ],
  model_provider: [
    { value: "GroqModel", label: "Groq" },
    { value: "GeminiModel", label: "Gemini" },
    { value: "OpenAIModel", label: "OpenAI" },
    { value: "AnthropicModel", label: "Anthropic" },
  ],
  embedding_model_provider: [
    { value: "GeminiModel", label: "Gemini" },
    { value: "OpenAIModel", label: "OpenAI" },
  ],
  tracing: [
    { value: "null", label: "Inherit (Default)" },
    { value: "true", label: "On" },
    { value: "false", label: "Off" },
  ],
  pool_tracing: [
    { value: "true", label: "On" },
    { value: "false", label: "Off" },
  ],
};
