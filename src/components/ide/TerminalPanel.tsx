// 终端面板组件
import { ScrollArea } from "@/components/ui/scroll-area";
import Ansi from "ansi-to-react";

interface TerminalPanelProps {
  output: string;
}

export function TerminalPanel({ output }: TerminalPanelProps) {
  return (
    <ScrollArea className="h-full bg-black text-green-400 p-4">
      <pre className="text-xs font-mono">
        <Ansi>{output}</Ansi>
      </pre>
    </ScrollArea>
  );
}
