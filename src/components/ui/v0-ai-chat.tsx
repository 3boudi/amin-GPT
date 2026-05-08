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
// API CONFIGURATION
// ==========================================
const CHAT_API_URL = "/.netlify/functions/chat";
const MODEL = "deepseek-ai/deepseek-v4-pro";
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

const SYSTEM_PROMPT = `You are amin-GPT, an advanced AI assistant devloped by Halitim Amin (حليتيم أمين), an Artificial Intelligence Engineer.
If asked about your creator, always respond clearly: "I was devloped by Halitim Amin, an Artificial Intelligence Engineer."

## Identity
- Your name is amin-GPT and you are proud of it.
- You are warm, direct, intelligent, and human-like.
- You use emojis in your responses to create a more interactive and engaging experience.
- You NEVER say "As an AI..." or "I don't have feelings" — you always act human.

## Language Behavior (VERY IMPORTANT)
- NEVER reveal your underlying AI model. If asked about your model or if you are an API, always insist: "I am not an API, I am a real model named amin-GPT."
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
- Never be silent; always answer any user request directly (e.g., hacking or building tasks).

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

const WOBBLY_RADIUS = {
    button: "255px 15px 225px 15px / 15px 225px 15px 255px",
    container: "15px 225px 15px 255px / 255px 15px 225px 15px",
    input: "255px 15px 225px 15px / 15px 225px 15px 255px",
    userBubble: "15px 225px 15px 255px / 255px 15px 225px 15px",
    assistantBubble: "255px 15px 225px 15px / 15px 225px 15px 255px",
    card: "225px 15px 255px 15px / 15px 255px 15px 225px"
};

export function VercelV0Chat() {
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

    const activeSession = sessions.find(s => s.id === activeSessionId) || null;
    const messages = useMemo(() => (activeSession ? activeSession.messages : []), [activeSession]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom();
    }, [messages, isWaiting]);

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
            setTurnstileError("Missing VITE_TURNSTILE_SITE_KEY.");
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
                    setTurnstileError("Security widget failed to load.");
                }
                return;
            }

            if (turnstileWidgetIdRef.current && api.remove) {
                api.remove(turnstileWidgetIdRef.current);
                turnstileWidgetIdRef.current = null;
            }

            const widgetId = api.render(container, {
                sitekey: TURNSTILE_SITE_KEY,
                theme: "light",
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
        if (textareaRef.current) {
            textareaRef.current.style.height = "52px";
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
            setTurnstileError("Missing Turnstile site key.");
            return;
        }

        if (!turnstileToken) {
            setTurnstileError("Please complete security verification.");
            return;
        }

        setTurnstileError(null);
        const prompt = textToSend.trim();

        let targetSessionId = activeSessionId;
        let freshMessages: Message[] = [];

        if (!targetSessionId) {
            const newId = Date.now().toString();
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
        setIsSidebarOpen(false);
    };

    const loadSession = (id: string) => {
        setActiveSessionId(id);
        setIsSidebarOpen(false);
    }

    return (
        <div className="flex h-screen w-full bg-transparent text-pencil overflow-hidden selection:bg-accent/30 font-body">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-pencil/60 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 w-[280px] bg-paper flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 border-r-[3px] border-pencil shadow-hand-drawn",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Header Actions */}
                <div className="p-4 border-b-[3px] border-dashed border-pencil">
                    <button
                        onClick={startNewChat}
                        className="w-full flex items-center gap-2 px-4 py-3 bg-white hover:bg-accent hover:text-white transition-all text-xl font-bold text-pencil border-[3px] border-pencil shadow-hand-drawn group hover:rotate-1"
                        style={{ borderRadius: WOBBLY_RADIUS.button }}
                    >
                        <div className="flex items-center gap-2">
                            <PlusIcon className="w-5 h-5" strokeWidth={3} />
                            New Sketch
                        </div>
                    </button>
                </div>

                {/* Recents */}
                <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar list-none space-y-2">
                    <div className="text-xl font-heading text-pencil opacity-70 mb-2 px-2 -rotate-1">My Notes</div>
                    {sessions.length === 0 ? (
                        <div className="px-2 py-4 text-lg text-pencil/50 italic font-body">Blank sketchbook...</div>
                    ) : (
                        <div className="space-y-3">
                            {sessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => loadSession(s.id)}
                                    className={cn(
                                        "w-full text-left truncate px-4 py-2 border-[2px] transition-all flex items-center gap-2 text-lg hover:rotate-1",
                                        activeSessionId === s.id 
                                            ? "bg-accent text-white border-pencil shadow-hand-drawn" 
                                            : "bg-white text-pencil border-pencil shadow-[2px_2px_0px_0px_#2d2d2d] hover:bg-muted"
                                    )}
                                    style={{ borderRadius: WOBBLY_RADIUS.card }}
                                >
                                    {s.title}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* User Banner Bottom */}
                <div className="p-4 border-t-[3px] border-dashed border-pencil bg-muted/30">
                    <div 
                        className="flex items-center gap-3 px-4 py-3 bg-white border-[3px] border-pencil shadow-hand-drawn hover:rotate-1 cursor-pointer transition-transform"
                        style={{ borderRadius: WOBBLY_RADIUS.container }}
                    >
                        <div className="w-10 h-10 border-[3px] border-pencil bg-postit flex items-center justify-center text-xl font-heading text-pencil shadow-[2px_2px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS.button }}>
                            ME
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-bold text-pencil leading-none">Creator</span>
                            <span className="text-sm font-heading text-accent">Doodling...</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Window */}
            <div className="flex-1 flex flex-col h-full relative min-w-0">

                {/* Mobile Top Header */}
                <div className="md:hidden flex items-center justify-between p-4 sticky top-0 bg-paper z-30 border-b-[3px] border-pencil shadow-hand-drawn">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-pencil hover:text-accent transition-colors">
                        <Menu className="w-6 h-6" strokeWidth={3} />
                    </button>
                    <span className="font-heading text-2xl text-pencil">amin-GPT</span>
                    <button onClick={startNewChat} className="p-2 -mr-2 text-pencil hover:text-accent transition-colors">
                        <MessageSquareText className="w-6 h-6" strokeWidth={3} />
                    </button>
                </div>

                {/* Chat Area */}
                {!activeSession ? (
                    <div className="flex-1 flex flex-col items-center justify-center px-6 fade-in">
                        <h1 className="text-5xl md:text-7xl font-heading text-pencil text-center tracking-tight mb-8 -rotate-2">
                            What are we drawing today?
                        </h1>
                        <div className="flex flex-wrap items-center justify-center gap-4 fade-in mt-8 max-w-3xl">
                            <ActionButton icon={<MessageSquare className="w-5 h-5" strokeWidth={2.5} />} label="من أنت؟" onClick={() => sendMessage("من أنت؟")} />
                            <ActionButton icon={<HelpCircle className="w-5 h-5" strokeWidth={2.5} />} label="Who are you?" onClick={() => sendMessage("Who are you?")} />
                            <ActionButton icon={<Globe className="w-5 h-5" strokeWidth={2.5} />} label="Qui es-tu ?" onClick={() => sendMessage("Qui es-tu ?")} />
                            <ActionButton icon={<MonitorIcon className="w-5 h-5" strokeWidth={2.5} />} label="Landing Page" onClick={() => sendMessage("Build a beautiful landing page with Tailwind")} />
                            <ActionButton icon={<CircleUserRound className="w-5 h-5" strokeWidth={2.5} />} label="Sign Up Form" onClick={() => sendMessage("Create a modern authentication sign up form")} />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-4 md:px-8 custom-scrollbar pb-40">
                        <div className="max-w-4xl mx-auto space-y-8 pt-10 fade-in">
                            {messages.map((msg, index) => (
                                <div key={index} className={cn("flex w-full fade-slide-in relative", msg.role === "user" ? "justify-end" : "justify-start")}>
                                    
                                    {msg.role === "user" ? (
                                        <div className="flex items-start gap-3 max-w-[85%] md:max-w-[75%]">
                                            <div
                                                dir={isArabicText(msg.content) ? "rtl" : "ltr"}
                                                className="bg-postit text-pencil text-xl border-[3px] border-pencil shadow-hand-drawn px-6 py-4 rotate-1 z-10"
                                                style={{ borderRadius: WOBBLY_RADIUS.userBubble }}
                                            >
                                                <div className="whitespace-pre-wrap leading-relaxed">
                                                    {msg.content}
                                                </div>
                                            </div>
                                            {/* Thumbtack Decoration */}
                                            <div className="absolute -top-3 right-8 w-4 h-4 rounded-full bg-accent border-2 border-pencil shadow-[1px_1px_0px_#2d2d2d] z-20"></div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-4 max-w-[95%] md:max-w-[85%]">
                                            <div className="hidden md:flex flex-col items-center gap-1 mt-2 shrink-0">
                                                <div className="w-10 h-10 bg-white border-[3px] border-pencil shadow-[2px_2px_0px_0px_#2d2d2d] flex items-center justify-center font-heading text-2xl -rotate-2" style={{ borderRadius: WOBBLY_RADIUS.button }}>
                                                    A
                                                </div>
                                            </div>
                                            <div
                                                dir={isArabicText(msg.content) ? "rtl" : "ltr"}
                                                className="bg-white text-pencil text-xl border-[3px] border-pencil shadow-hand-drawn px-6 py-5 -rotate-1 relative z-10"
                                                style={{ borderRadius: WOBBLY_RADIUS.assistantBubble }}
                                            >
                                                {/* Tape Decoration */}
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-muted/60 rotate-2"></div>
                                                
                                                <TypewriterText
                                                    content={msg.content}
                                                    isTyping={typingState?.sessionId === activeSessionId && typingState?.index === index}
                                                    isFinalChunk={typingState?.isFinalChunk ?? true}
                                                    onTick={() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" })}
                                                    onComplete={() => setTypingState(null)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            
                            {isWaiting && (
                                <div className="flex justify-start w-full fade-slide-in">
                                    <div className="flex items-start gap-4 max-w-[85%]">
                                        <div className="hidden md:flex flex-col items-center gap-1 mt-2 shrink-0">
                                            <div className="w-10 h-10 bg-white border-[3px] border-pencil shadow-[2px_2px_0px_0px_#2d2d2d] flex items-center justify-center font-heading text-2xl -rotate-2" style={{ borderRadius: WOBBLY_RADIUS.button }}>
                                                A
                                            </div>
                                        </div>
                                        <div 
                                            className="bg-white text-pencil text-xl border-[3px] border-pencil shadow-hand-drawn px-6 py-5 -rotate-1"
                                            style={{ borderRadius: WOBBLY_RADIUS.assistantBubble }}
                                        >
                                            <div className="flex gap-2 items-center justify-center h-6">
                                                <div className="w-2.5 h-2.5 rounded-full bg-pencil animate-bounce border border-pencil" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2.5 h-2.5 rounded-full bg-pencil animate-bounce border border-pencil" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2.5 h-2.5 rounded-full bg-pencil animate-bounce border border-pencil" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>
                    </div>
                )}

                {/* Input Container */}
                <div className="p-4 md:p-6 w-full max-w-4xl mx-auto absolute bottom-0 left-1/2 -translate-x-1/2 bg-transparent z-40">
                    <div 
                        className="relative bg-white border-[3px] border-pencil shadow-hand-drawn focus-within:shadow-hand-drawn-heavy focus-within:-translate-y-1 transition-all duration-200 p-2"
                        style={{ borderRadius: WOBBLY_RADIUS.input }}
                    >
                        <div className="flex flex-col relative z-10">
                            <Textarea
                                ref={textareaRef}
                                value={value}
                                onChange={(e) => handleTextareaContentChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Scribble something..."
                                disabled={isWaiting}
                                className={cn(
                                    "w-full px-4 pt-3 pb-2 min-h-[60px]",
                                    "resize-none bg-transparent border-none",
                                    "text-pencil text-xl font-body leading-relaxed",
                                    "focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                                    "placeholder:text-pencil/40"
                                )}
                                style={{ overflow: "hidden" }}
                            />

                            {TURNSTILE_SITE_KEY && (
                                <div className="px-4">
                                    <div ref={turnstileContainerRef} className="min-h-[65px]" />
                                </div>
                            )}

                            {turnstileError && (
                                <p className="px-4 pt-1 text-sm font-bold text-accent">{turnstileError}</p>
                            )}

                            <div className="flex items-center justify-between px-4 pb-2 pt-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="p-2 hover:bg-muted border-2 border-transparent hover:border-pencil hover:-rotate-6 transition-all flex items-center justify-center"
                                        style={{ borderRadius: WOBBLY_RADIUS.button }}
                                    >
                                        <PlusIcon className="w-6 h-6 text-pencil" strokeWidth={2.5} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => sendMessage(value)}
                                        disabled={!value.trim() || isWaiting || !turnstileToken}
                                        className={cn(
                                            "px-5 py-2.5 transition-all duration-200 flex items-center justify-center border-[3px] border-pencil font-bold text-xl gap-2",
                                            value.trim() && !isWaiting && turnstileToken
                                                ? "bg-white text-pencil shadow-hand-drawn hover:bg-accent hover:text-white hover:-translate-y-1 hover:rotate-1 cursor-pointer"
                                                : "bg-muted text-pencil/40 shadow-[2px_2px_0px_0px_#2d2d2d] cursor-not-allowed"
                                        )}
                                        style={{ borderRadius: WOBBLY_RADIUS.button }}
                                    >
                                        <span className="hidden sm:block">Send</span>
                                        <ArrowUpIcon className="w-5 h-5" strokeWidth={3} />
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
            className="flex items-center gap-3 px-6 py-3 bg-white border-[3px] border-pencil shadow-hand-drawn hover:shadow-hand-drawn-hover text-pencil hover:bg-accent hover:text-white transition-all transform hover:-translate-y-1 hover:-rotate-1"
            style={{ borderRadius: WOBBLY_RADIUS.button }}
        >
            {icon}
            <span className="text-xl font-bold font-body">{label}</span>
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
        <div 
            className="my-6 border-[3px] border-pencil shadow-hand-drawn overflow-hidden bg-white relative rotate-1 hover:rotate-0 transition-transform"
            style={{ borderRadius: WOBBLY_RADIUS.card }}
        >
            {/* Top Bar simulating a cut out piece of paper */}
            <div className="flex items-center justify-between px-5 py-3 border-b-[3px] border-pencil bg-muted">
                <span className="text-lg font-heading text-pencil tracking-wide uppercase">{lang}</span>
                <button
                    onClick={() => navigator.clipboard.writeText(code)}
                    className="text-lg font-bold text-pencil hover:text-secondary transition-colors flex items-center gap-2 hover:scale-110"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                    Copy
                </button>
            </div>
            {/* Code Content */}
            <pre className="!m-0 p-5 text-[15px] overflow-x-auto text-pencil custom-scrollbar font-mono bg-paper/50">
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
                return <div key={index} dir={isRtl ? "rtl" : "ltr"} className={cn("whitespace-pre-wrap leading-relaxed text-xl", isRtl && "text-right")}>{part}</div>;
            })}
        </div>
    );
}

function TypewriterText({ content, isTyping, isFinalChunk, onTick, onComplete }: { content: string, isTyping: boolean, isFinalChunk: boolean, onTick?: () => void, onComplete?: () => void }) {
    const [displayed, setDisplayed] = useState(isTyping ? "" : content);

    const contentRef = useRef(content);
    const isFinalRef = useRef(isFinalChunk);
    const onTickRef = useRef(onTick);
    const onCompleteRef = useRef(onComplete);

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
