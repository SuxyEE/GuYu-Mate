// Monaco Editor 组件
import { useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  filePath: string;
}

export function CodeEditor({ value, onChange, filePath }: CodeEditorProps) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  // 根据文件扩展名检测语言
  const getLanguage = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      txt: "plaintext",
    };
    return langMap[ext || ""] || "plaintext";
  };

  const handleChange = (newValue: string | undefined) => {
    if (newValue === undefined) return;

    // 防抖保存
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Editor
      height="100%"
      language={getLanguage(filePath)}
      value={value}
      onChange={handleChange}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        automaticLayout: true,
      }}
    />
  );
}
