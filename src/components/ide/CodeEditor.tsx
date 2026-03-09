// Monaco Editor 组件
import { useEffect, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  filePath: string;
  onSelectionChange?: (selectedText: string) => void;
}

export function CodeEditor({ value, onChange, filePath, onSelectionChange }: CodeEditorProps) {
  const timeoutRef = useRef<NodeJS.Timeout>();

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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 500);
  };

  const handleEditorMount: OnMount = (editor) => {
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (selection && onSelectionChange) {
        const selectedText = editor.getModel()?.getValueInRange(selection) || "";
        onSelectionChange(selectedText);
      }
    });
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
      onMount={handleEditorMount}
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
