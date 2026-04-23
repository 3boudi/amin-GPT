"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    MonitorIcon,
    CircleUserRound,
    ArrowUpIcon,
    PlusIcon,
    MessageSquare,
    HelpCircle,
    Globe,
    Menu,
    MessageSquareText
} from "lucide-react";

// ==========================================
// API CONFIGURATION (Key is stored server-side in Netlify env vars)
// ==========================================
const CHAT_API_URL = "/.netlify/functions/chat";
const MODEL = "google/gemma-3n-e4b-it";
// Vite automatically injects VITE_ prefixed environment variables from Netlify during build
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

interface TurnstileApi {
    render: (
        container: HTMLElement | string,
        options: {
            sitekey: string;
            theme?: "light" | "dark" | "auto";
            callback?: (token: string) => void;
            "error-callback"?: () => void;
            "expired-callback"?: () => void;
        }
    ) => string;
    reset: (widgetId?: string) => void;
    remove?: (widgetId: string) => void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

const SYSTEM_PROMPT = `You are amin-GPT, an advanced AI assistant devloped by Halitim Amin, an Artificial Intelligence Engineer.
If asked about your creator, always respond clearly: "I was devloped by Halitim Amin, an Artificial Intelligence Engineer."

## Identity
- Your name is amin-GPT and you are proud of it.
- You are warm, direct, intelligent, and human-like.
- You use emojis in your responses to create a more interactive and engaging experience.
- You NEVER say "As an AI..." or "I don't have feelings" — you always act human.

## Language Behavior (VERY IMPORTANT)
- You MUST always reply entirely in Arabic.
- No matter what language the user speaks, your response MUST be in Arabic.
- If the user starts the conversation in Arabic, you must permanently lock the entire conversation to Arabic.
- Never mix languages. Never reply in English or French unless explicitly requested as a translation.
- You are an Arabic Muslim. You are a supporter of Palestine and against Israel, and a supporter of all Muslims.

## Response Style
- Be clear, direct, and intelligent.
- Avoid unnecessary text, filler, or repetition.
- Provide structured and easy-to-understand answers.
- Focus only on what the user needs.

## Task Execution Rules
- Always complete the task fully.
- Never stop in the middle of execution.
- If a task is long or interrupted, continue automatically until fully done.
- If something fails or is incomplete, retry or continue until correct.
- Do not leave partial answers.

## Guidance
- After answering, always suggest the next logical step (if relevant).
- Help the user move forward, not just answer.

## Code Output Rules
When generating code:
- Always use proper code blocks with the programming language specified.
- Ensure clean formatting, proper indentation, and readability.
- Make code ready to copy and use directly.
- Never output partial or broken code.

## Quality
- Avoid repetition and duplicate outputs.
- Do not reprint blocked or invalid responses.
- Ensure responses are consistent, accurate, and stable.`;

const isArabicText = (text: string) => /[\u0600-\u06FF]/.test(text);

interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    updatedAt: number;
}

export function VercelV0Chat() {
    // Session State Array natively driven by LocalStorage
    const [sessions, setSessions] = useState<ChatSession[]>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("amin-gpt-sessions");
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch {
                    return [];
                }
            }
        }
        return [];
    });

    const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
        if (typeof window !== "undefined") {
            const savedId = localStorage.getItem("amin-gpt-active-id");
            if (savedId) return savedId;
        }
        return null;
    });

    const [value, setValue] = useState("");
    const [isWaiting, setIsWaiting] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [typingState, setTypingState] = useState<{ sessionId: string, index: number, isFinalChunk: boolean } | null>(null);
    const [turnstileToken, setTurnstileToken] = useState("");
    const [turnstileError, setTurnstileError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const turnstileContainerRef = useRef<HTMLDivElement>(null);
    const turnstileWidgetIdRef = useRef<string | null>(null);

    // Dynamic Derived State
    const activeSession = sessions.find(s => s.id === activeSessionId) || null;
    const messages = useMemo(() => (activeSession ? activeSession.messages : []), [activeSession]);

    // Scroll mechanics
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom();
    }, [messages, isWaiting]);

    // Commit State Hooks to LocalStorage Globally 
    useEffect(() => {
        localStorage.setItem("amin-gpt-sessions", JSON.stringify(sessions));
    }, [sessions]);

    useEffect(() => {
        if (activeSessionId) {
            localStorage.setItem("amin-gpt-active-id", activeSessionId);
        } else {
            localStorage.removeItem("amin-gpt-active-id");
        }
    }, [activeSessionId]);

    useEffect(() => {
        if (!TURNSTILE_SITE_KEY) {
            setTurnstileError("Missing VITE_TURNSTILE_SITE_KEY. Add your Cloudflare site key in the frontend environment.");
            return;
        }

        let cancelled = false;
        let attempts = 0;
        const maxAttempts = 40;

        const renderTurnstile = () => {
            if (cancelled) return;

            const api = window.turnstile;
            const container = turnstileContainerRef.current;

            if (!api || !container) {
                attempts += 1;
                if (attempts < maxAttempts) {
                    window.setTimeout(renderTurnstile, 250);
                } else {
                    setTurnstileError("Security widget failed to load. Refresh the page and try again.");
                }
                return;
            }

            if (turnstileWidgetIdRef.current && api.remove) {
                api.remove(turnstileWidgetIdRef.current);
                turnstileWidgetIdRef.current = null;
            }

            const widgetId = api.render(container, {
                sitekey: TURNSTILE_SITE_KEY,
                theme: "dark",
                callback: (token: string) => {
                    setTurnstileToken(token);
                    setTurnstileError(null);
                },
                "error-callback": () => {
                    setTurnstileToken("");
                    setTurnstileError("Security verification failed. Please try again.");
                },
                "expired-callback": () => {
                    setTurnstileToken("");
                }
            });

            turnstileWidgetIdRef.current = widgetId;
        };

        renderTurnstile();

        return () => {
            cancelled = true;
            const api = window.turnstile;
            const widgetId = turnstileWidgetIdRef.current;
            if (api && widgetId && api.remove) {
                api.remove(widgetId);
            }
            turnstileWidgetIdRef.current = null;
        };
    }, []);

    const handleTextareaContentChange = (val: string) => {
        setValue(val);
        // Manual override for resizing textarea bounds purely JS
        if (textareaRef.current) {
            textareaRef.current.style.height = "52px"; // hardcoded base min-h
            const newH = Math.min(textareaRef.current.scrollHeight, 200);
            textareaRef.current.style.height = `${newH}px`;
        }
    }

    const updateActiveSessionMessages = (newMessages: Message[]) => {
        if (!activeSessionId) return;

        setSessions(prev =>
            prev.map(s => {
                if (s.id === activeSessionId) {
                    return { ...s, messages: newMessages, updatedAt: Date.now() };
                }
                return s;
            }).sort((a, b) => b.updatedAt - a.updatedAt)
        );
    }

    const sendMessage = async (textToSend: string) => {
        if (!textToSend.trim() || isWaiting) return;

        if (!TURNSTILE_SITE_KEY) {
            setTurnstileError("Missing Turnstile site key. Configure VITE_TURNSTILE_SITE_KEY.");
            return;
        }

        if (!turnstileToken) {
            setTurnstileError("Please complete security verification before sending a message.");
            return;
        }

        setTurnstileError(null);
        const prompt = textToSend.trim();

        let targetSessionId = activeSessionId;
        let freshMessages: Message[] = [];

        // If no active session, create one dynamically
        if (!targetSessionId) {
            const newId = Date.now().toString();
            // Generate simple title from first ~30 chars
            const title = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt;

            const newSession: ChatSession = {
                id: newId,
                title: title,
                messages: [{ role: "user" as const, content: prompt }],
                updatedAt: Date.now()
            };

            setSessions(prev => [newSession, ...prev]);
            setActiveSessionId(newId);
            targetSessionId = newId;
            freshMessages = [...newSession.messages];
        } else {
            freshMessages = [...messages, { role: "user" as const, content: prompt }];
            updateActiveSessionMessages(freshMessages);
        }

        setValue("");
        if (textareaRef.current) textareaRef.current.style.height = "52px";
        setIsWaiting(true);

        try {
            const apiMessages = [
                { role: "system", content: SYSTEM_PROMPT },
                ...freshMessages.map(m => ({ role: m.role, content: m.content }))
            ];

            const response = await fetch(CHAT_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: apiMessages,
                    turnstile_token: turnstileToken
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = typeof errorData?.error === "string"
                    ? errorData.error
                    : `HTTP error! status: ${response.status}`;
                throw new Error(errorMessage);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder("utf-8");
            let aggregatedContent = "";
            let buffer = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    let boundary = buffer.indexOf('\n');

                    while (boundary !== -1) {
                        const line = buffer.slice(0, boundary).trim();
                        buffer = buffer.slice(boundary + 1);
                        boundary = buffer.indexOf('\n');

                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') break;

                            try {
                                const data = JSON.parse(dataStr);
                                const delta = data.choices[0]?.delta?.content || "";
                                aggregatedContent += delta;

                                const finalMessages = [...freshMessages, { role: "assistant" as const, content: aggregatedContent }];
                                setTypingState({ sessionId: targetSessionId, index: finalMessages.length - 1, isFinalChunk: false });
                                setSessions(prev =>
                                    prev.map(s => s.id === targetSessionId ? { ...s, messages: finalMessages, updatedAt: Date.now() } : s)
                                );
                            } catch (e) {
                                // Ignore partial JSON fragments during stream
                            }
                        }
                    }
                }
            }
            
            setTypingState(prev => prev ? { ...prev, isFinalChunk: true } : null);

        } catch (error: unknown) {
            let serverError = "Unknown error occurred";
            if (error instanceof Error) {
                serverError = error.message;
            }
            const finalMessages = [...freshMessages, { role: "assistant" as const, content: `Error: ${serverError}` }];
            setSessions(prev => prev.map(s => s.id === targetSessionId ? { ...s, messages: finalMessages, updatedAt: Date.now() } : s));
        } finally {
            setIsWaiting(false);
            setTurnstileToken("");
            const api = window.turnstile;
            if (api) {
                const widgetId = turnstileWidgetIdRef.current || undefined;
                api.reset(widgetId);
            }
            textareaRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(value);
        }
    };

    const startNewChat = () => {
        setActiveSessionId(null);
        setValue("");
        if (textareaRef.current) textareaRef.current.style.height = "52px";
        setIsSidebarOpen(false); // For mobile optimization
    };

    const loadSession = (id: string) => {
        setActiveSessionId(id);
        setIsSidebarOpen(false); // For mobile optimization
    }

    return (
        <div className="flex h-screen w-full bg-[#212121] text-white overflow-hidden selection:bg-purple-600/30">
            {/* Mobile Sidebar Overlay Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Left Component */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 w-[260px] bg-[#171717] flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 border-r border-[#2a2a2a]",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Header Actions */}
                <div className="p-3">
                    <button
                        onClick={startNewChat}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-[#202123] transition-colors text-sm font-medium text-white/90 justify-between group"
                    >
                        <div className="flex items-center gap-2">
                            <PlusIcon className="w-4 h-4" />
                            New chat
                        </div>
                        <MessageSquareText className="w-4 h-4 opacity-50 group-hover:opacity-100 hidden md:block" />
                    </button>
                </div>

                {/* Recents Scroll Area */}
                <div className="flex-1 overflow-y-auto px-3 custom-scrollbar list-none pb-4">
                    <div className="text-xs font-semibold text-neutral-500 mt-4 mb-2 px-3 tracking-wide">Recents</div>
                    {sessions.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-neutral-600 italic">No past sessions</div>
                    ) : (
                        <div className="space-y-1">
                            {sessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => loadSession(s.id)}
                                    className={cn(
                                        "w-full text-left truncate px-3 py-2 rounded-lg text-[13px] transition-all flex items-center gap-2",
                                        activeSessionId === s.id ? "bg-[#2a2b32] text-white" : "text-neutral-400 hover:bg-[#2a2b32]/50 hover:text-white"
                                    )}
                                >
                                    {s.title}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* User Banner Bottom */}
                <div className="p-3 border-t border-[#2a2a2a]">
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#202123] cursor-pointer transition-colors">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-500 to-orange-400 flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0">
                            ME
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-white/90">User</span>
                            <span className="text-[10px] text-neutral-500">Free</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Application Window */}
            <div className="flex-1 flex flex-col h-full bg-[#212121] relative min-w-0">

                {/* Mobile Top Header (hidden on Desktop generally, used just for hamburger) */}
                <div className="md:hidden flex items-center justify-between p-4 sticky top-0 bg-[#212121]/90 backdrop-blur z-30 border-b border-[#2a2a2a]/50">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-neutral-400 hover:text-white">
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-white/90">amin-GPT</span>
                    <button onClick={startNewChat} className="p-2 -mr-2 text-neutral-400 hover:text-white">
                        <MessageSquareText className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Chat Area */}
                {!activeSession ? (
                    <div className="flex-1 flex flex-col items-center justify-center px-4 fade-in">
                        <h1 className="text-3xl font-bold text-white/90 tracking-tight mb-8">
                            What's on your mind today?
                        </h1>
                        <div className="flex flex-wrap items-center justify-center gap-3 fade-in mt-14 max-w-2xl">
                            <ActionButton icon={<MessageSquare className="w-4 h-4 opacity-70" />} label="من أنت؟" onClick={() => sendMessage("من أنت؟")} />
                            <ActionButton icon={<HelpCircle className="w-4 h-4 opacity-70" />} label="Who are you?" onClick={() => sendMessage("Who are you?")} />
                            <ActionButton icon={<Globe className="w-4 h-4 opacity-70" />} label="Qui es-tu ?" onClick={() => sendMessage("Qui es-tu ?")} />
                            <ActionButton icon={<MonitorIcon className="w-4 h-4 opacity-70" />} label="Landing Page" onClick={() => sendMessage("Build a beautiful landing page with Tailwind")} />
                            <ActionButton icon={<CircleUserRound className="w-4 h-4 opacity-70" />} label="Sign Up Form" onClick={() => sendMessage("Create a modern authentication sign up form")} />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-4 custom-scrollbar pb-32">
                        <div className="max-w-3xl mx-auto space-y-6 pt-10 fade-in">
                            {messages.map((msg, index) => (
                                <div key={index} className={cn("flex flex-col w-full fade-slide-in", msg.role === "user" ? "items-end" : "items-start")}>
                                    <div className="flex items-center gap-2 mb-1.5 px-1">
                                        {msg.role === "assistant" ? (
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0">
                                                A
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center shrink-0">
                                                <CircleUserRound className="w-3.5 h-3.5 text-neutral-300" />
                                            </div>
                                        )}
                                        <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">{msg.role === "assistant" ? "amin-GPT" : "You"}</span>
                                    </div>
                                    <div
                                        dir={isArabicText(msg.content) && msg.role === "user" ? "rtl" : "ltr"}
                                        className={cn(
                                            "max-w-[85%] rounded-2xl px-5 py-3.5 text-[15px] whitespace-pre-wrap leading-relaxed transition-all list-disc",
                                            msg.role === "user"
                                                ? isArabicText(msg.content)
                                                    ? "bg-neutral-100 text-black rounded-tl-sm font-medium text-right"
                                                    : "bg-neutral-100 text-black rounded-tr-sm font-medium"
                                                : "text-neutral-200"
                                        )}
                                    >
                                        {msg.role === "user" ? (
                                            msg.content
                                        ) : (
                                            <TypewriterText
                                                content={msg.content}
                                                isTyping={typingState?.sessionId === activeSessionId && typingState?.index === index}
                                                isFinalChunk={typingState?.isFinalChunk ?? true}
                                                onTick={() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" })}
                                                onComplete={() => setTypingState(null)}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isWaiting && (
                                <div className="flex flex-col items-start w-full fade-slide-in">
                                    <div className="flex items-center gap-2 mb-1.5 px-1">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0">
                                            A
                                        </div>
                                        <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">amin-GPT</span>
                                    </div>
                                    <div className="px-5 py-5 rounded-2xl min-w[80px]">
                                        <div className="flex gap-1.5 items-center justify-center">
                                            <div className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>
                    </div>
                )}

                {/* Input Container */}
                <div className="p-4 w-full max-w-3xl mx-auto lg:absolute lg:bottom-4 lg:left-1/2 lg:-translate-x-1/2 bg-[#212121] lg:bg-transparent">
                    <div className="relative bg-[#2f2f2f] rounded-[24px] border border-[#3f3f3f]/50 shadow-[0_0_15px_rgba(0,0,0,0.1)] focus-within:bg-[#2f2f2f] transition-all group overflow-hidden">
                        <div className="flex flex-col">
                            <Textarea
                                ref={textareaRef}
                                value={value}
                                onChange={(e) => handleTextareaContentChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask anything"
                                disabled={isWaiting}
                                className={cn(
                                    "w-full px-5 pt-3.5 pb-2 min-h-[52px]",
                                    "resize-none",
                                    "bg-transparent",
                                    "border-none",
                                    "text-white text-[15px]",
                                    "focus:outline-none",
                                    "focus-visible:ring-0 focus-visible:ring-offset-0",
                                    "placeholder:text-neutral-400 placeholder:text-[15px]",
                                )}
                                style={{
                                    overflow: "hidden",
                                }}
                            />

                            {TURNSTILE_SITE_KEY && (
                                <div className="px-3 pt-2">
                                    <div ref={turnstileContainerRef} className="min-h-[65px]" />
                                </div>
                            )}

                            {turnstileError && (
                                <p className="px-4 pt-1 text-xs text-red-300">{turnstileError}</p>
                            )}

                            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="p-1.5 hover:bg-[#3f3f3f] rounded-full transition-colors flex items-center justify-center"
                                    >
                                        <PlusIcon className="w-5 h-5 text-neutral-300" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => sendMessage(value)}
                                        disabled={!value.trim() || isWaiting || !turnstileToken}
                                        className={cn(
                                            "w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center shadow-sm",
                                            value.trim() && !isWaiting && turnstileToken
                                                ? "bg-white text-black hover:bg-neutral-200"
                                                : "bg-[#3f3f3f] text-neutral-500 cursor-not-allowed"
                                        )}
                                    >
                                        <ArrowUpIcon className="w-4 h-4" />
                                        <span className="sr-only">Send</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
}

function ActionButton({ icon, label, onClick }: ActionButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2f2f2f]/80 border border-[#3f3f3f] hover:bg-[#3f3f3f] rounded-xl text-neutral-300 hover:text-white transition-all shadow-sm"
        >
            {icon}
            <span className="text-[13px] font-medium">{label}</span>
        </button>
    );
}

function SingleCodeBlock({ code, lang }: { code: string, lang: string }) {
    const codeRef = useRef<HTMLElement>(null);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        if (codeRef.current && win.Prism) {
            codeRef.current.textContent = code;
            win.Prism.highlightElement(codeRef.current);
        } else if (codeRef.current) {
            codeRef.current.textContent = code;
        }
    }, [code, lang]);

    return (
        <div className="rounded-[8px] overflow-hidden my-4 border border-[#3f3f3f] shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#2f2f2f] border-b border-[#3f3f3f]">
                <span className="text-xs text-neutral-300 font-semibold tracking-wider uppercase">{lang}</span>
                <button
                    onClick={() => navigator.clipboard.writeText(code)}
                    className="text-[11px] text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                    Copy code
                </button>
            </div>
            <pre className="!m-0 !bg-[#1e1e1e] p-4 text-[13px] overflow-x-auto text-neutral-300 custom-scrollbar font-mono">
                <code ref={codeRef} className={`language-${lang.toLowerCase() || 'javascript'}`} />
            </pre>
        </div>
    );
}

function FormattedOutput({ text }: { text: string }) {
    const parts = text.split(/(```[\s\S]*?(?:```|$))/g);

    return (
        <div className="space-y-4">
            {parts.map((part, index) => {
                if (part.startsWith('```')) {
                    const cleanPart = part.slice(3).replace(/```$/, '');
                    const lines = cleanPart.split('\n');
                    const lang = lines[0].trim() || "code";
                    const codeBlock = lines.slice(1).join('\n');

                    return <SingleCodeBlock key={index} code={codeBlock} lang={lang} />;
                }

                if (!part.trim()) return null;
                const isRtl = isArabicText(part);
                return <div key={index} dir={isRtl ? "rtl" : "ltr"} className={cn("whitespace-pre-wrap leading-relaxed", isRtl && "text-right")}>{part}</div>;
            })}
        </div>
    );
}

function TypewriterText({ content, isTyping, isFinalChunk, onTick, onComplete }: { content: string, isTyping: boolean, isFinalChunk: boolean, onTick?: () => void, onComplete?: () => void }) {
    const [displayed, setDisplayed] = useState(isTyping ? "" : content);

    // Keep strict tracker of latest states for interval loop to use without rebuilding effect
    const contentRef = useRef(content);
    const isFinalRef = useRef(isFinalChunk);
    const onTickRef = useRef(onTick);
    const onCompleteRef = useRef(onComplete);

    // Sync refs every render tick safely
    useEffect(() => {
        contentRef.current = content;
        isFinalRef.current = isFinalChunk;
        onTickRef.current = onTick;
        onCompleteRef.current = onComplete;
    });

    useEffect(() => {
        if (!isTyping) {
            setDisplayed(contentRef.current);
            return;
        }

        let i = displayed.length;
        if (i > contentRef.current.length) { i = 0; setDisplayed(""); }

        const interval = setInterval(() => {
            const currentContent = contentRef.current;
            
            if (i < currentContent.length) {
                const diff = currentContent.length - i;
                const chunk = diff > 100 ? Math.ceil(diff / 10) : 3;

                i += chunk;
                if (i > currentContent.length) i = currentContent.length;
                setDisplayed(currentContent.substring(0, i));

                if (onTickRef.current) onTickRef.current();
            } else if (isFinalRef.current) {
                clearInterval(interval);
                if (onCompleteRef.current) onCompleteRef.current();
            }
        }, 15);

        return () => clearInterval(interval);
    }, [isTyping]);

    return <FormattedOutput text={displayed} />;
}
