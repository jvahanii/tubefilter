import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Filter,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Eye,
  Sparkles,
  X,
  Trash2,
  Youtube,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockChannels, mockVideos, type MockVideo } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  component: FeedPage,
});

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatRelative(iso: string) {
  const diffH = (Date.now() - new Date(iso).getTime()) / 3600_000;
  if (diffH < 1) return `${Math.round(diffH * 60)}m ago`;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`;
  return `${n} views`;
}

type LengthFilter = "any" | "short" | "medium" | "long";

function FeedPage() {
  const [search, setSearch] = useState("");
  const [maxAgeDays, setMaxAgeDays] = useState<number>(7);
  const [lengthFilter, setLengthFilter] = useState<LengthFilter>("any");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [includeKeywords, setIncludeKeywords] = useState("");
  const [hideShorts, setHideShorts] = useState(true);
  const [activeChannelIds, setActiveChannelIds] = useState<string[]>(
    mockChannels.map((c) => c.id),
  );
  const [sort, setSort] = useState<"recent" | "for-you">("recent");
  const [votes, setVotes] = useState<Record<string, "up" | "down" | undefined>>({});
  const [showFilters, setShowFilters] = useState(true);
  const [newChannel, setNewChannel] = useState("");

  const toggleChannel = (id: string) =>
    setActiveChannelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const visibleVideos = useMemo(() => {
    const inc = includeKeywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    const exc = excludeKeywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    let list = mockVideos.filter((v) => {
      if (!activeChannelIds.includes(v.channelId)) return false;
      if (votes[v.id] === "down") return false;
      const ageH = (Date.now() - new Date(v.uploadedAt).getTime()) / 3600_000;
      if (ageH > maxAgeDays * 24) return false;
      if (hideShorts && v.durationSec < 90) return false;
      if (lengthFilter === "short" && v.durationSec >= 240) return false;
      if (lengthFilter === "medium" && (v.durationSec < 240 || v.durationSec > 1200)) return false;
      if (lengthFilter === "long" && v.durationSec <= 1200) return false;
      const t = v.title.toLowerCase();
      if (search && !t.includes(search.toLowerCase())) return false;
      if (inc.length && !inc.some((k) => t.includes(k))) return false;
      if (exc.length && exc.some((k) => t.includes(k))) return false;
      return true;
    });

    if (sort === "recent") {
      list = [...list].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      );
    } else {
      list = [...list].sort((a, b) => {
        const ba = (votes[b.id] === "up" ? 0.2 : 0) + b.score;
        const aa = (votes[a.id] === "up" ? 0.2 : 0) + a.score;
        return ba - aa;
      });
    }
    return list;
  }, [
    activeChannelIds,
    votes,
    maxAgeDays,
    hideShorts,
    lengthFilter,
    search,
    includeKeywords,
    excludeKeywords,
    sort,
  ]);

  const hiddenCount = mockVideos.length - visibleVideos.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-rose-500 to-orange-500 text-white">
            <Youtube className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">My Feed</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Personalised YouTube
            </div>
          </div>
        </div>

        <div className="relative ml-4 hidden flex-1 max-w-xl md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inside your feed…"
            className="pl-9"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as "recent" | "for-you")}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="for-you">For you</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 lg:px-6">
        {/* Sidebar: My Channels */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">My channels</h2>
              <Badge variant="secondary">{mockChannels.length}</Badge>
            </div>

            <div className="flex gap-2">
              <Input
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                placeholder="Add @handle or URL"
                className="h-9"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setNewChannel("")}
                aria-label="Add channel"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-220px)] pr-2">
              <ul className="space-y-1">
                {mockChannels.map((c) => {
                  const active = activeChannelIds.includes(c.id);
                  const lastVid = mockVideos
                    .filter((v) => v.channelId === c.id)
                    .sort(
                      (a, b) =>
                        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
                    )[0];
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => toggleChannel(c.id)}
                        className={`group flex w-full items-center gap-3 rounded-md p-2 text-left transition ${
                          active ? "bg-accent" : "hover:bg-accent/50 opacity-60"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-base ${c.color}`}
                        >
                          <span>{c.avatar}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {lastVid ? `Last: ${formatRelative(lastVid.uploadedAt)}` : c.handle}
                          </div>
                        </div>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>
        </aside>

        {/* Main feed */}
        <main className="min-w-0 flex-1">
          {/* Filter chips summary */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Last {maxAgeDays}d
            </Badge>
            {lengthFilter !== "any" && (
              <Badge variant="outline" className="gap-1">
                Length: {lengthFilter}
              </Badge>
            )}
            {hideShorts && <Badge variant="outline">No shorts</Badge>}
            {includeKeywords && (
              <Badge variant="outline">+ {includeKeywords}</Badge>
            )}
            {excludeKeywords && (
              <Badge variant="destructive" className="gap-1">
                <X className="h-3 w-3" />
                {excludeKeywords}
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              Showing {visibleVideos.length} · {hiddenCount} hidden by filters
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleVideos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                vote={votes[v.id]}
                onVote={(dir) =>
                  setVotes((prev) => ({
                    ...prev,
                    [v.id]: prev[v.id] === dir ? undefined : dir,
                  }))
                }
              />
            ))}
            {visibleVideos.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                No videos match your filters.
              </div>
            )}
          </div>
        </main>

        {/* Filter rail */}
        {showFilters && (
          <aside className="hidden w-80 shrink-0 xl:block">
            <div className="sticky top-20 space-y-6 rounded-lg border bg-card p-5">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Filters</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Max age</Label>
                  <span className="text-xs text-muted-foreground">
                    {maxAgeDays} day{maxAgeDays > 1 ? "s" : ""}
                  </span>
                </div>
                <Slider
                  value={[maxAgeDays]}
                  min={1}
                  max={30}
                  step={1}
                  onValueChange={([v]) => setMaxAgeDays(v)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">Video length</Label>
                <Select
                  value={lengthFilter}
                  onValueChange={(v) => setLengthFilter(v as LengthFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any length</SelectItem>
                    <SelectItem value="short">Short (&lt; 4 min)</SelectItem>
                    <SelectItem value="medium">Medium (4–20 min)</SelectItem>
                    <SelectItem value="long">Long (&gt; 20 min)</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center justify-between pt-2">
                  <Label htmlFor="hide-shorts" className="text-xs">
                    Hide YouTube Shorts
                  </Label>
                  <Switch
                    id="hide-shorts"
                    checked={hideShorts}
                    onCheckedChange={setHideShorts}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">Include keywords</Label>
                <Input
                  value={includeKeywords}
                  onChange={(e) => setIncludeKeywords(e.target.value)}
                  placeholder="e.g. javascript, ai"
                />
                <Label className="text-xs">Exclude keywords</Label>
                <Input
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                  placeholder="e.g. drama, reaction"
                />
              </div>

              <Separator />

              <div className="rounded-md bg-accent/40 p-3 text-xs text-muted-foreground">
                <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Learning from you
                </div>
                Thumbs up boost similar videos. Thumbs down hides them and trains the
                ranker.
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function VideoCard({
  video,
  vote,
  onVote,
}: {
  video: MockVideo;
  vote: "up" | "down" | undefined;
  onVote: (dir: "up" | "down") => void;
}) {
  const channel = mockChannels.find((c) => c.id === video.channelId)!;
  return (
    <article className="group overflow-hidden rounded-xl border bg-card transition hover:border-foreground/20 hover:shadow-lg">
      <div
        className={`relative aspect-video w-full bg-gradient-to-br ${video.thumbnailGradient}`}
      >
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(video.durationSec)}
        </span>
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
          <Sparkles className="h-3 w-3" />
          {Math.round(video.score * 100)}% match
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm ${channel.color}`}
          >
            {channel.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
              {video.title}
            </h3>
            <div className="mt-1 text-xs text-muted-foreground">
              {channel.name} · {formatRelative(video.uploadedAt)}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              {formatViews(video.views)}
            </div>
          </div>
        </div>

        <div className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Why this:</span> {video.reason}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button
              variant={vote === "up" ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => onVote("up")}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              More like this
            </Button>
            <Button
              variant={vote === "down" ? "destructive" : "outline"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => onVote("down")}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-8">
            Watch
          </Button>
        </div>
      </div>
    </article>
  );
}
