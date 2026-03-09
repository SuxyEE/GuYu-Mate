import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink } from "lucide-react";

interface PreviewPanelProps {
  previewUrl: string | null;
  onRefresh: () => void;
}

export function PreviewPanel({ previewUrl, onRefresh }: PreviewPanelProps) {
  const [key, setKey] = useState(0);

  const handleRefresh = () => {
    setKey(prev => prev + 1);
    onRefresh();
  };

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  if (!previewUrl) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>暂无预览</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <span className="text-sm font-medium">预览</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleOpenExternal}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 bg-white">
        <iframe
          key={key}
          src={previewUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  );
}
