// AI 对话面板组件
import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, FileEdit, FilePlus, FileX, Trash2, Sparkles, Code, MessageSquare, Bug, TestTube } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  operations?: FileOperation[];
}

interface FileOperation {
  type: "create" | "modify" | "delete";
  path: string;
}

interface AIChatPanelProps {
  projectPath: string;
  context?: {
    selectedFile?: string;
    selectedCode?: string;
    openFiles?: string[];
  };
  onSendMessage: (message: string, context?: {
    selectedFile?: string;
    selectedCode?: string;
    openFiles?: string[];
  }) => Promise<void>;
  onFileOperations?: (ops: FileOperation[]) => void;
  onAutoPreview?: () => void;
}

export function AIChatPanel({ projectPath, context, onSendMessage, onFileOperations, onAutoPreview }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentOperations, setCurrentOperations] = useState<FileOperation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getStorageKey = () => `ide-session-${projectPath}`;

  useEffect(() => {
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (error) {
        console.error("加载会话失败:", error);
      }
    }
  }, [projectPath]);

  useEffect(() => {
    if (messages.length > 0) {
      const key = getStorageKey();
      localStorage.setItem(key, JSON.stringify(messages));
    }
  }, [messages, projectPath]);

  useEffect(() => {
    const unlisten = listen<any>("agent-event", (event) => {
      const agentEvent = event.payload;

      switch (agentEvent.type) {
        case "thinking":
        case "response":
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + agentEvent.text },
              ];
            }
            return [...prev, { role: "assistant", content: agentEvent.text }];
          });
          break;

        case "file_operation":
          const op = agentEvent.operation;
          const fileOp: FileOperation = {
            type: op.type,
            path: op.path,
          };
          setCurrentOperations((prev) => [...prev, fileOp]);
          break;

        case "tool_call":
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              const toolInfo = `\n\n🔧 **调用工具**: \`${agentEvent.name}\``;
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + toolInfo },
              ];
            }
            return prev;
          });
          break;

        case "tool_result":
          // 不显示工具结果，只在出错时显示
          if (agentEvent.result.includes('错误:')) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                const resultInfo = `\n❌ ${agentEvent.result}`;
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + resultInfo },
                ];
              }
              return prev;
            });
          }
          break;

        case "error":
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `❌ 错误: ${agentEvent.message}`,
          }]);
          setIsLoading(false);
          break;

        case "done":
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && currentOperations.length > 0) {
              return [
                ...prev.slice(0, -1),
                { ...last, operations: currentOperations },
              ];
            }
            return prev;
          });
          if (currentOperations.length > 0) {
            onAutoPreview?.();
          }
          setCurrentOperations([]);
          setIsLoading(false);
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [currentOperations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && lastMsg.operations && lastMsg.operations.length > 0) {
      onFileOperations?.(lastMsg.operations);
    }
  }, [messages, onFileOperations]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // 传递上下文信息
      await onSendMessage(userMessage, context);
    } catch (error) {
      console.error("发送消息失败:", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `❌ 发送失败: ${error}`,
      }]);
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (confirm("确定要清空对话历史吗？")) {
      setMessages([]);
      localStorage.removeItem(getStorageKey());

      try {
        await invoke("clear_ide_session", { projectPath });
      } catch (error) {
        console.error("清空会话失败:", error);
      }
    }
  };

  const skills = [
    { icon: Code, label: "解释代码", prompt: "请解释以下代码的功能和实现原理" },
    { icon: Sparkles, label: "优化代码", prompt: "请优化以下代码，提高性能和可读性" },
    { icon: MessageSquare, label: "添加注释", prompt: "请为以下代码添加详细的注释" },
    { icon: Bug, label: "修复错误", prompt: "请检查并修复以下代码中的错误" },
    { icon: TestTube, label: "生成测试", prompt: "请为以下代码生成单元测试" },
  ];

  const handleSkillClick = (prompt: string) => {
    setInput(prompt);
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case "create": return <FilePlus className="h-3 w-3" />;
      case "modify": return <FileEdit className="h-3 w-3" />;
      case "delete": return <FileX className="h-3 w-3" />;
      default: return null;
    }
  };

  const getOperationVariant = (type: string) => {
    switch (type) {
      case "create": return "default";
      case "modify": return "secondary";
      case "delete": return "destructive";
      default: return "default";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm font-medium">AI 助手</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearHistory}
          disabled={messages.length === 0}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 w-full max-w-full">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex min-w-0 w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-full sm:max-w-[85%] rounded-lg p-3 break-words ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:overflow-x-auto [&_code]:break-words [&_pre_code]:break-normal">
                      {msg.content}
                    </ReactMarkdown>
                    {msg.operations && msg.operations.length > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-1">
                        {msg.operations.map((op, idx) => (
                          <Badge
                            key={idx}
                            variant={getOperationVariant(op.type) as any}
                            className="flex items-center gap-1 text-xs"
                          >
                            {getOperationIcon(op.type)}
                            <span>{op.type === "create" ? "创建" : op.type === "modify" ? "修改" : "删除"}: {op.path}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-full sm:max-w-[85%] rounded-lg p-3 bg-muted">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                  </div>
                  <span>思考中...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t space-y-3">
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <Button
              key={skill.label}
              variant="outline"
              size="sm"
              onClick={() => handleSkillClick(skill.prompt)}
              disabled={isLoading}
              className="text-xs"
            >
              <skill.icon className="h-3 w-3 mr-1" />
              {skill.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="描述你想要实现的功能..."
            className="min-h-[80px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={isLoading} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
