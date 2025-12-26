"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { ChevronDown, Maximize2, X, Minimize2 } from 'lucide-react';

// Type definitions
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'boolean';

export interface SelectOption {
    value: string;
    label: string;
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
}

// Boolean options for dropdown
const BOOLEAN_OPTIONS: SelectOption[] = [
    { value: 'true', label: 'True' },
    { value: 'false', label: 'False' },
    { value: 'null', label: 'Inherit (null)' },
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
    color = 'text-primary',
    disabled = false,
    mono = false,
    expandable = false,
}: EditableFieldProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false); // Expanded modal state
    const [localValue, setLocalValue] = useState(value);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
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
                if (type === 'number') {
                    finalValue = finalValue === '' || finalValue === null ? null : Number(finalValue);
                } else if (type === 'boolean') {
                    if (finalValue === 'true') finalValue = true;
                    else if (finalValue === 'false') finalValue = false;
                    else if (finalValue === 'null') finalValue = null;
                }
                latestOnChangeRef.current(finalValue);
            }
        };
    }, [type]);

    // Sync local value when prop changes
    useEffect(() => {
        setLocalValue(value);
        hasChangedRef.current = false;
    }, [value]);

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
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced auto-save
    const handleInputChange = useCallback((newValue: string) => {
        setLocalValue(newValue);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            let finalValue: any = newValue;
            if (type === 'number') {
                finalValue = newValue === '' || newValue === null ? null : Number(newValue);
            }
            onChange(finalValue);
        }, DEBOUNCE_DELAY);
    }, [type, onChange]);

    const handleSave = useCallback(() => {
        let finalValue = localValue;
        if (type === 'number') {
            finalValue = localValue === '' || localValue === null ? null : Number(localValue);
        } else if (type === 'boolean') {
            if (localValue === 'true') finalValue = true;
            else if (localValue === 'false') finalValue = false;
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

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && type !== 'textarea') {
            handleSave();
        } else if (e.key === 'Escape') {
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
    }, [type, handleSave, handleCancel, isExpanded]);

    const handleSelectOption = useCallback((optionValue: string) => {
        setLocalValue(optionValue);
        setIsDropdownOpen(false);
        let finalValue: any = optionValue;
        if (type === 'boolean') {
            if (optionValue === 'true') finalValue = true;
            else if (optionValue === 'false') finalValue = false;
            else finalValue = null;
        }
        onChange(finalValue);
    }, [type, onChange]);

    const getDisplayValue = () => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'True' : 'False';
        if (type === 'select' && options) {
            const opt = options.find(o => o.value === String(value));
            return opt?.label || String(value);
        }
        return String(value);
    };

    // Theme Classes
    const baseColor = color.replace('text-', '');
    const theme = {
        border: `border-${baseColor}/30`,
        focusBorder: `focus:border-${baseColor}`,
        hoverBorder: `hover:border-${baseColor}/50`,
        bgSoft: `bg-${baseColor}/10`,
        text: color
    };

    // --- Modal Component ---
    const ExpandedModal = () => {
        if (!isExpanded) return null;

        // Derive theme colors from the text color prop
        // color is usually like "text-blue-400" -> we want "border-blue-500/30" and "bg-blue-500/10"
        const baseColor = color.replace('text-', '');
        const borderColor = `border-${baseColor}/20`;
        const headerBg = `bg-${baseColor}/5`;
        const iconColor = color; // keep text color for icon

        // Use portal to escape sidebar transform context
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm p-8 animate-in fade-in duration-200">
                <div
                    // Reduced size: max-w-3xl and h-[60vh] for a more compact feel
                    className={cn(
                        "w-full max-w-3xl h-[60vh] min-h-[400px] bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden border",
                        borderColor
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className={cn("flex items-center justify-between px-6 py-4 border-b", borderColor, headerBg)}>
                        <div className="flex items-center gap-3">
                            {Icon && <Icon className={cn("w-5 h-5 opacity-80", iconColor)} />}
                            <span className={cn("font-medium text-lg tracking-tight", iconColor)}>{label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                title="Close (Auto-saved)"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Editor Area - kept clean/neutral for readability */}
                    <div className="flex-1 p-0 relative bg-card/50">
                        <textarea
                            autoFocus
                            value={localValue || ''}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            className={cn(
                                "w-full h-full p-6 bg-transparent border-none resize-none focus:ring-0 text-base leading-relaxed text-foreground placeholder-muted-foreground/50",
                                mono && "font-mono"
                            )}
                        />
                    </div>

                    {/* Footer / Status */}
                    <div className={cn("px-6 py-3 border-t bg-muted/5 text-xs text-muted-foreground flex justify-between items-center", borderColor)}>
                        <span>{localValue?.length || 0} characters</span>
                        <span>Changes save automatically</span>
                    </div>
                </div>

                {/* Backdrop click to close */}
                <div className="absolute inset-0 -z-10" onClick={() => setIsExpanded(false)} />
            </div>,
            document.body
        );
    };

    // Render select/dropdown
    if (type === 'select' || type === 'boolean') {
        const selectOptions = type === 'boolean' ? BOOLEAN_OPTIONS : options || [];
        const currentLabel = selectOptions.find(o =>
            o.value === String(value) ||
            (type === 'boolean' && o.value === (value === true ? 'true' : value === false ? 'false' : 'null'))
        )?.label || getDisplayValue();

        return (
            <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    {Icon && <Icon className="w-3 h-3 opacity-60" />}
                    {label}
                </div>
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
                        disabled={disabled}
                        className={cn(
                            "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all",
                            "bg-secondary/50 border border-border hover:bg-secondary/70",
                            theme.hoverBorder,
                            disabled && "opacity-50 cursor-not-allowed",
                            mono && "font-mono"
                        )}
                    >
                        <span className="truncate">{currentLabel}</span>
                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isDropdownOpen && "rotate-180")} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                            {selectOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleSelectOption(opt.value)}
                                    className={cn(
                                        "w-full px-3 py-2 text-sm text-left hover:bg-secondary/50 transition-colors",
                                        (String(value) === opt.value ||
                                            (type === 'boolean' && opt.value === (value === true ? 'true' : value === false ? 'false' : 'null')))
                                        && cn(theme.bgSoft, theme.text)
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Render textarea
    if (type === 'textarea') {
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
                                mono && "font-mono text-xs"
                            )}
                        >
                            <div className="line-clamp-3 whitespace-pre-wrap break-words opacity-80 group-hover:opacity-100">
                                {value || <span className="text-muted-foreground italic">{placeholder || 'Click to edit code...'}</span>}
                            </div>

                            {/* Expand Hint Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 rounded-lg pointer-events-none">
                                <div className="bg-background/80 backdrop-blur px-2 py-1 rounded text-[10px] font-medium text-foreground border border-border flex items-center gap-1.5">
                                    <Maximize2 className="w-3 h-3" />
                                    Click into Editor
                                </div>
                            </div>
                        </div>
                        <ExpandedModal />
                    </>
                ) : (
                    /* Existing Inline Logic for non-expandable */
                    isEditing ? (
                        <textarea
                            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                            value={localValue || ''}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    handleCancel();
                                }
                            }}
                            placeholder={placeholder}
                            disabled={disabled}
                            rows={4}
                            className={cn(
                                "w-full px-3 py-2 rounded-lg text-sm resize-y min-h-[80px]",
                                "bg-secondary/50 border focus:outline-none",
                                theme.border, theme.focusBorder,
                                mono && "font-mono text-xs"
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
                                mono && "font-mono text-xs"
                            )}
                            style={{ scrollbarWidth: 'thin' }}
                        >
                            {value || <span className="text-muted-foreground italic">{placeholder || 'Click to edit...'}</span>}
                        </div>
                    )
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
                        type={type === 'number' ? 'number' : 'text'}
                        value={localValue ?? ''}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled}
                        step={type === 'number' ? 'any' : undefined}
                        className={cn(
                            "flex-1 px-3 py-1.5 rounded-lg text-sm",
                            "bg-secondary/50 border focus:outline-none",
                            theme.border, theme.focusBorder,
                            mono && "font-mono"
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
                        mono && "font-mono"
                    )}
                >
                    {getDisplayValue() || <span className="text-muted-foreground italic">{placeholder || 'Click to edit...'}</span>}
                </div>
            )}
        </div>
    );
}

// Pre-configured option sets
export const FIELD_OPTIONS = {
    on_error: [
        { value: 'raise', label: 'Raise Exception' },
        { value: 'return_error', label: 'Return Error' },
        { value: 'return_none', label: 'Return None' },
    ],
    context_strategy: [
        { value: 'smart', label: 'Smart' },
        { value: 'trim_last', label: 'Trim Last' },
        { value: 'trim_first', label: 'Trim First' },
        { value: 'summarize', label: 'Summarize' },
        { value: 'first_last', label: 'First & Last' },
    ],
    store_type: [
        { value: 'session_buffer', label: 'Session Buffer' },
        { value: 'file', label: 'File' },
        { value: 'sqlite', label: 'SQLite' },
        { value: 'postgresql', label: 'PostgreSQL' },
        { value: 'redis', label: 'Redis' },
    ],
    model_provider: [
        { value: 'GroqModel', label: 'Groq' },
        { value: 'GeminiModel', label: 'Gemini' },
        { value: 'OpenAIModel', label: 'OpenAI' },
        { value: 'AnthropicModel', label: 'Anthropic' },
    ],
};
