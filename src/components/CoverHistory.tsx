import { useState } from "react";
import { History, Play, Download, Trash2, Search, X, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { coverHistoryService, type CoverHistoryItem } from "@/services/coverHistoryService";

interface CoverHistoryProps {
  onLoadCover: (item: CoverHistoryItem) => void;
  onSeparateStems: (item: CoverHistoryItem) => void;
}

export default function CoverHistory({ onLoadCover, onSeparateStems }: CoverHistoryProps) {
  const [history, setHistory] = useState<CoverHistoryItem[]>(coverHistoryService.getHistory());
  const [searchQuery, setSearchQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const refreshHistory = () => {
    setHistory(coverHistoryService.getHistory());
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete "${title}" from history?`)) {
      coverHistoryService.deleteFromHistory(id);
      refreshHistory();
      toast.success("Deleted from history");
    }
  };

  const handleClearAll = () => {
    if (confirm("Clear all cover history? This cannot be undone.")) {
      coverHistoryService.clearHistory();
      refreshHistory();
      toast.success("History cleared");
    }
  };

  const handleDownload = (url: string, title: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.mp3`;
    a.click();
    toast.success(`Downloading ${title}...`);
  };

  const filteredHistory = searchQuery
    ? coverHistoryService.search(searchQuery)
    : history;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Cover History
          </CardTitle>
          <CardDescription>Your generated covers will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No covers generated yet</p>
            <p className="text-sm mt-2">Generate your first cover to see it here!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Cover History
            </CardTitle>
            <CardDescription>
              {history.length} cover{history.length !== 1 ? 's' : ''} generated
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
          >
            Clear All
          </Button>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search covers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex gap-4">
                  {/* Cover Image */}
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-20 h-20 rounded object-cover flex-shrink-0"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold truncate">{item.title}</h4>
                      {item.audioId && (
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 text-xs rounded flex items-center gap-1">
                          <Music className="w-3 h-3" />
                          Stems Ready
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                      {item.tags && (
                        <span className="px-2 py-0.5 bg-primary/10 rounded">
                          {item.tags}
                        </span>
                      )}
                      <span>{formatDuration(item.duration)}</span>
                      <span>•</span>
                      <span>{item.settings.model}</span>
                      <span>•</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>

                    {/* Audio Player */}
                    <audio
                      controls
                      className="w-full mt-2 h-8"
                      onPlay={() => setPlayingId(item.id)}
                      onPause={() => setPlayingId(null)}
                    >
                      <source src={item.audioUrl} />
                    </audio>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onLoadCover(item)}
                      title="Load this cover"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Load
                    </Button>
                    {item.audioId && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => onSeparateStems(item)}
                        title="Separate into stems"
                        className="bg-primary"
                      >
                        <Music className="w-4 h-4 mr-1" />
                        Stems
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(item.audioUrl, item.title)}
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(item.id, item.title)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Settings Info */}
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <div className="grid grid-cols-2 gap-2">
                    {item.settings.style && (
                      <div>Style: {item.settings.style}</div>
                    )}
                    {item.settings.negativeTags && (
                      <div>Excluded: {item.settings.negativeTags}</div>
                    )}
                    <div>Style Weight: {item.settings.styleWeight.toFixed(2)}</div>
                    <div>Creativity: {item.settings.weirdnessConstraint.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {filteredHistory.length === 0 && searchQuery && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No covers found matching "{searchQuery}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
