// AI 对话面板组件
import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, FileEdit, FilePlus, FileX, Trash2, Sparkles, Code, MessageSquare, Bug, TestTube, History, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ideApi, type IdeSession } from "@/lib/api/ide";

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
  }, resumeSessionId?: string) => Promise<void>;
  onFileOperations?: (ops: FileOperation[]) => void;
  onAutoPreview?: () => void;
}

export function AIChatPanel({ projectPath, context, onSendMessage, onFileOperations, onAutoPreview }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentOperations, setCurrentOperations] = useState<FileOperation[]>([]);
  const [sessions, setSessions] = useState<IdeSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
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
      // 检查是否需要强制创建新会话
      const clearedKey = `${getStorageKey()}-cleared`;
      const forceNew = localStorage.getItem(clearedKey) === "true";

      if (forceNew) {
        // 清除标记并强制新会话（传递特殊的 resume 值）
        localStorage.removeItem(clearedKey);
        await onSendMessage(userMessage, context, "new");
      } else {
        await onSendMessage(userMessage, context);
      }
    } catch (error) {
      console.error("发送消息失败:", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `❌ 发送失败: ${error}`,
      }]);
      setIsLoading(false);
    }
  };

  const handleNewSession = () => {
    if (messages.length > 0 && !confirm("确定要创建新会话吗？当前会话将被保存。")) {
      return;
    }
    setMessages([]);
    localStorage.removeItem(getStorageKey());
    localStorage.setItem(`${getStorageKey()}-cleared`, "true");
  };

  const handleClearHistory = async () => {
    if (confirm("确定要清空对话历史吗？")) {
      setMessages([]);
      localStorage.removeItem(getStorageKey());
      localStorage.setItem(`${getStorageKey()}-cleared`, "true");

      try {
        await ideApi.clearSession(projectPath);
      } catch (error) {
        console.error("清空会话失败:", error);
      }
    }
  };

  const handleLoadSessions = async () => {
    try {
      const list = await ideApi.listSessions(projectPath);
      setSessions(list);
      setShowSessions(true);
    } catch (error) {
      console.error("加载会话列表失败:", error);
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    setShowSessions(false);
    setIsLoading(true);
    try {
      const content = await ideApi.loadSessionMessages(projectPath, sessionId);
      const lines = content.trim().split('\n');
      const loadedMessages: Message[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // 只处理 user 和 assistant 类型的消息
          if (entry.type === 'user' && entry.message) {
            const msg = entry.message;
            let text = '';

            // content 可能是字符串或数组
            if (typeof msg.content === 'string') {
              text = msg.content;
            } else if (Array.isArray(msg.content)) {
              text = msg.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text)
                .join('\n');
            }

            if (text) {
              loadedMessages.push({ role: 'user', content: text });
            }
          } else if (entry.type === 'assistant' && entry.message) {
            const msg = entry.message;

            // assistant 的 content 是数组
            if (Array.isArray(msg.content)) {
              const text = msg.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text)
                .join('\n');

              if (text) {
                loadedMessages.push({ role: 'assistant', content: text });
              }
            }
          }
        } catch (e) {
          console.warn('解析消息失败:', e);
        }
      }

      setMessages(loadedMessages);
      localStorage.setItem(getStorageKey(), JSON.stringify(loadedMessages));
    } catch (error) {
      console.error("加载会话失败:", error);
    } finally {
      setIsLoading(false);
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
        <span className="text-sm font-medium">Claude Code</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewSession}
            disabled={isLoading}
            title="新建会话"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadSessions}
            disabled={isLoading}
            title="会话历史"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            title="清空历史"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showSessions && (
        <div className="p-2 border-b bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">会话历史</span>
            <Button variant="ghost" size="sm" onClick={() => setShowSessions(false)}>
              <span className="text-xs">关闭</span>
            </Button>
          </div>
          <ScrollArea className="h-32">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">暂无历史会话</p>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <Button
                    key={session.session_id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => handleResumeSession(session.session_id)}
                  >
                    <div className="flex flex-col items-start gap-1 w-full">
                      <span className="truncate w-full">{session.title}</span>
                      <span className="text-muted-foreground">
                        {new Date(session.created_at * 1000).toLocaleString()} · {session.message_count} 条消息
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

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
