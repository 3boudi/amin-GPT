import { useEffect, useRef, useCallback, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import axios from "axios";
import {
    MonitorIcon,
    CircleUserRound,
    ArrowUpIcon,
    Paperclip,
    PlusIcon,
    MessageSquare,
    HelpCircle,
    Globe
} from "lucide-react";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;

            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function VercelV0Chat() {
    const [value, setValue] = useState("");
    const [isWaiting, setIsWaiting] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom();
    }, [messages, isWaiting]);

    const sendMessage = async (textToSend: string) => {
        if (!textToSend.trim() || isWaiting) return;

        const newMessages = [...messages, { role: "user" as const, content: textToSend.trim() }];
        setMessages(newMessages);
        setValue("");
        adjustHeight(true);
        setIsWaiting(true);

        try {
            const response = await axios.post("http://localhost/amin-GPT/chat.php", {
                messages: newMessages
            });
            
            if (response.data?.reply) {
                setMessages(prev => [...prev, { role: "assistant", content: response.data.reply }]);
            } else if (response.data?.error) {
                setMessages(prev => [...prev, { role: "assistant", content: `Error: ${response.data.error}` }]);
            }
        } catch (error: unknown) {
            let serverError = "Unknown error occurred";
            if (axios.isAxiosError(error)) {
                serverError = error.response?.data?.error || error.message;
            } else if (error instanceof Error) {
                serverError = error.message;
            }
            setMessages(prev => [...prev, { role: "assistant", content: `Error: ${serverError}` }]);
        } finally {
            setIsWaiting(false);
            textareaRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(value);
        }
    };

    const handleActionClick = (prompt: string) => {
        sendMessage(prompt);
    };

    const startNewChat = () => {
        setMessages([]);
        setValue("");
        adjustHeight(true);
        setIsWaiting(false);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-8 min-h-screen relative pt-16">
            
            {/* Top Navigation / Header */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50">
                <button 
                    onClick={startNewChat}
                    className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 hover:opacity-80 transition-opacity"
                >
                    amin-GPT
                </button>
                {messages.length > 0 && (
                    <button 
                        onClick={startNewChat}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-full text-xs font-medium text-neutral-300 hover:text-white transition-all shadow-sm"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        New Chat
                    </button>
                )}
            </div>

            {messages.length === 0 ? (
                <div className="text-center mt-32 fade-in">
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-4">
                        What can I help you ship?
                    </h1>
                    <p className="text-neutral-500 font-medium tracking-wide">
                        Your intelligent multilingual assistant
                    </p>
                    <div className="flex gap-3 justify-center mt-6 mb-12">
                        <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 font-medium">Arabic</span>
                        <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 font-medium">English</span>
                        <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 font-medium">French</span>
                    </div>
                </div>
            ) : (
                <div className="w-full flex-1 overflow-y-auto mb-4 space-y-6 lg:max-h-[70vh] max-h-[60vh] pr-4 custom-scrollbar fade-in mt-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={cn("flex flex-col w-full fade-slide-in", msg.role === "user" ? "items-end" : "items-start")}>
                            <div className="flex items-center gap-2 mb-1.5 px-1">
                                {msg.role === "assistant" ? (
                                    <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0">
                                        A
                                    </div>
                                ) : (
                                    <div className="w-5 h-5 rounded-md bg-neutral-800 flex items-center justify-center shrink-0">
                                        <CircleUserRound className="w-3 h-3 text-neutral-400" />
                                    </div>
                                )}
                                <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">{msg.role === "assistant" ? "amin-GPT" : "You"}</span>
                            </div>
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl px-5 py-3.5 text-sm whitespace-pre-wrap leading-relaxed shadow-sm transition-all",
                                    msg.role === "user" 
                                        ? "bg-white text-black rounded-tr-sm" 
                                        : "bg-[#141414] border border-[#2a2a2a] text-neutral-100 rounded-tl-sm hover:border-[#3a3a3a]"
                                )}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isWaiting && (
                        <div className="flex flex-col items-start w-full fade-slide-in">
                            <div className="flex items-center gap-2 mb-1.5 px-1">
                                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0">
                                    A
                                </div>
                                <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">amin-GPT</span>
                            </div>
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl rounded-tl-sm px-5 py-5 shadow-sm min-w[80px]">
                                <div className="flex gap-1.5 items-center h-2 justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            )}

            <div className={cn("w-full transition-all duration-500 ease-in-out", messages.length > 0 ? "sticky bottom-6 z-10" : "mt-8")}>
                <div className="relative bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] shadow-[0_4px_30px_rgba(0,0,0,0.5)] focus-within:ring-1 focus-within:ring-[#3a3a3a] transition-all group">
                    <div className="overflow-y-auto max-h-[40vh] custom-scrollbar">
                        <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                adjustHeight();
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask amin-GPT a question..."
                            disabled={isWaiting}
                            className={cn(
                                "w-full px-5 pt-4 pb-2",
                                "resize-none",
                                "bg-transparent",
                                "border-none",
                                "text-white text-[15px]",
                                "focus:outline-none",
                                "focus-visible:ring-0 focus-visible:ring-offset-0",
                                "placeholder:text-neutral-500 placeholder:text-[15px] placeholder:font-medium",
                                "min-h-[60px]"
                            )}
                            style={{
                                overflow: "hidden",
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="group/attach p-2 hover:bg-neutral-800 rounded-xl transition-colors flex items-center gap-1"
                            >
                                <Paperclip className="w-4 h-4 text-neutral-400 group-hover/attach:text-white transition-colors" />
                                <span className="text-xs font-medium text-neutral-500 hidden group-hover/attach:inline transition-opacity">
                                    Attach
                                </span>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="px-4 py-2 rounded-full text-xs font-medium text-neutral-400 transition-all border border-dashed border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 flex items-center gap-1.5"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                Project
                            </button>
                            <button
                                type="button"
                                onClick={() => sendMessage(value)}
                                disabled={!value.trim() || isWaiting}
                                className={cn(
                                    "p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center shadow-sm",
                                    value.trim() && !isWaiting
                                        ? "bg-white text-black hover:bg-neutral-200 hover:scale-[1.02]"
                                        : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                                )}
                            >
                                <ArrowUpIcon className="w-4 h-4" />
                                <span className="sr-only">Send</span>
                            </button>
                        </div>
                    </div>
                </div>

                {messages.length === 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-8 fade-in">
                        <ActionButton
                            icon={<MessageSquare className="w-4 h-4 text-neutral-400" />}
                            label="من أنت؟"
                            onClick={() => handleActionClick("من أنت؟")}
                        />
                        <ActionButton
                            icon={<HelpCircle className="w-4 h-4 text-neutral-400" />}
                            label="Who are you?"
                            onClick={() => handleActionClick("Who are you?")}
                        />
                        <ActionButton
                            icon={<Globe className="w-4 h-4 text-neutral-400" />}
                            label="Qui es-tu ?"
                            onClick={() => handleActionClick("Qui es-tu ?")}
                        />
                        <ActionButton
                            icon={<MonitorIcon className="w-4 h-4 text-neutral-400" />}
                            label="Landing Page"
                            onClick={() => handleActionClick("Build a beautiful landing page with Tailwind")}
                        />
                        <ActionButton
                            icon={<CircleUserRound className="w-4 h-4 text-neutral-400" />}
                            label="Sign Up Form"
                            onClick={() => handleActionClick("Create a modern authentication sign up form")}
                        />
                    </div>
                )}
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
            className="flex items-center gap-2 px-5 py-2.5 bg-[#141414] border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 hover:scale-[1.02] active:scale-[0.98] rounded-full text-neutral-400 hover:text-white transition-all shadow-sm"
        >
            {icon}
            <span className="text-xs font-semibold tracking-wide">{label}</span>
        </button>
    );
}
