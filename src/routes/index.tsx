import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Plus,
  Filter,
  
  Eye,
  EyeOff,
  Sparkles,
  X,
  Trash2,
  Youtube,
  SlidersHorizontal,
  Compass,
  Check,
  Users,
  Loader2,
  LogOut,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  mockChannels,
  mockVideos,
  type MockChannel,
  type MockVideo,
} from "@/lib/mock-data";
import {
  searchYouTubeChannels,
  searchYouTubeVideos,
  getChannelUploads,
  type YTChannel,
  type YTVideo,
} from "@/lib/youtube.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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

function formatSubs(n?: number) {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M subs`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K subs`;
  return `${n} subs`;
}

type LengthFilter = "any" | "short" | "medium" | "long";

function FeedPage() {
  const [search, setSearch] = useState("");
  
  const [lengthFilter, setLengthFilter] = useState<LengthFilter>("any");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [includeKeywords, setIncludeKeywords] = useState("");
  const [hideShorts, setHideShorts] = useState(true);
  const [channels, setChannels] = useState<MockChannel[]>([]);
  const [videos, setVideos] = useState<MockVideo[]>([]);
  const [activeChannelIds, setActiveChannelIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const { user, signOut } = useAuth();

  // Load saved feed state from Supabase for the signed-in user
  useEffect(() => {
    if (!user) {
      setHydrated(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("Failed to load preferences", error.message);
      } else if (data?.data) {
        const parsed = data.data as {
          channels?: MockChannel[];
          activeChannelIds?: string[];
          hiddenIds?: string[];
        };
        if (parsed.channels?.length) setChannels(parsed.channels);
        if (parsed.activeChannelIds?.length)
          setActiveChannelIds(parsed.activeChannelIds);
        if (parsed.hiddenIds?.length) setHiddenIds(parsed.hiddenIds);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Persist whenever the user's curated state changes (debounced)
  useEffect(() => {
    if (!hydrated || !user) return;
    const handle = setTimeout(async () => {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          data: { channels, activeChannelIds, hiddenIds },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) console.warn("Failed to persist preferences", error.message);
    }, 500);
    return () => clearTimeout(handle);
  }, [hydrated, user, channels, activeChannelIds, hiddenIds]);

  // Re-fetch uploads for any saved channels after hydration so the feed fills in
  const fetchedRestoredRef = useRef(false);
  const [showFilters, setShowFilters] = useState(true);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [loadingChannelId, setLoadingChannelId] = useState<string | null>(null);
  const [channelPaging, setChannelPaging] = useState<
    Record<string, { uploadsPlaylistId: string; nextPageToken: string | null }>
  >({});
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchUploads = useServerFn(getChannelUploads);

  // After hydration, fetch uploads for any restored channels (once)
  useEffect(() => {
    if (!hydrated || fetchedRestoredRef.current) return;
    if (channels.length === 0) return;
    fetchedRestoredRef.current = true;
    (async () => {
      const results = await Promise.all(
        channels.map(async (c) => {
          try {
            const page = await fetchUploads({ data: { channelId: c.id, max: 15 } });
            return { id: c.id, page, name: c.name };
          } catch (e) {
            console.error("Failed to restore channel uploads", c.id, e);
            return null;
          }
        }),
      );
      setVideos((prev) => {
        const existing = new Set(prev.map((v) => v.id));
        const additions: MockVideo[] = [];
        for (const r of results) {
          if (!r) continue;
          for (const v of r.page.videos) {
            if (existing.has(v.id)) continue;
            existing.add(v.id);
            additions.push({
              id: v.id,
              channelId: v.channelId,
              title: v.title,
              thumbnailUrl: v.thumbnailUrl,
              durationSec: v.durationSec,
              uploadedAt: v.uploadedAt,
              views: v.views,
              score: 0.7,
              reason: `Recent upload from ${r.name}`,
            });
          }
        }
        return [...prev, ...additions];
      });
      setChannelPaging((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (!r) continue;
          next[r.id] = {
            uploadsPlaylistId: r.page.uploadsPlaylistId,
            nextPageToken: r.page.nextPageToken,
          };
        }
        return next;
      });
    })();
  }, [hydrated, channels, fetchUploads]);

  const loadSampleData = () => {
    setChannels(mockChannels);
    setVideos(mockVideos);
    setActiveChannelIds([]);
  };

  const toggleChannel = (id: string) =>
    setActiveChannelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const clearChannelSelection = () => setActiveChannelIds([]);

  const removeChannel = (id: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== id));
    setActiveChannelIds((prev) => prev.filter((x) => x !== id));
    setVideos((prev) => prev.filter((v) => v.channelId !== id));
  };


  const addRealChannel = async (ch: YTChannel) => {
    if (channels.some((c) => c.id === ch.id)) {
      return;
    }

    setLoadingChannelId(ch.id);
    try {
      const newChannel: MockChannel = {
        id: ch.id,
        name: ch.name,
        handle: ch.handle ? (ch.handle.startsWith("@") ? ch.handle : `@${ch.handle}`) : "",
        avatarUrl: ch.avatarUrl,
        subscribers: ch.subscribers,
        topics: ch.topics,
      };
      setChannels((prev) => [...prev, newChannel]);


      const page = await fetchUploads({ data: { channelId: ch.id, max: 15 } });
      const newVideos: MockVideo[] = page.videos.map((v: YTVideo) => ({
        id: v.id,
        channelId: v.channelId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        durationSec: v.durationSec,
        uploadedAt: v.uploadedAt,
        views: v.views,
        score: 0.7,
        reason: `Recent upload from ${v.channelName}`,
      }));
      setVideos((prev) => {
        const existing = new Set(prev.map((v) => v.id));
        return [...prev, ...newVideos.filter((v) => !existing.has(v.id))];
      });
      setChannelPaging((prev) => ({
        ...prev,
        [ch.id]: {
          uploadsPlaylistId: page.uploadsPlaylistId,
          nextPageToken: page.nextPageToken,
        },
      }));
    } catch (e) {
      console.error("Failed to load channel uploads", e);
    } finally {
      setLoadingChannelId(null);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const effectiveIds =
      activeChannelIds.length > 0 ? activeChannelIds : channels.map((c) => c.id);
    const targets = effectiveIds
      .map((id) => ({ id, paging: channelPaging[id] }))
      .filter((t) => t.paging?.nextPageToken);
    if (targets.length === 0) return;

    setLoadingMore(true);
    try {
      const results = await Promise.all(
        targets.map(async (t) => {
          try {
            const page = await fetchUploads({
              data: {
                channelId: t.id,
                max: 15,
                pageToken: t.paging!.nextPageToken!,
                uploadsPlaylistId: t.paging!.uploadsPlaylistId,
              },
            });
            return { id: t.id, page };
          } catch (e) {
            console.error("Failed to paginate channel", t.id, e);
            return null;
          }
        }),
      );
      const channelNameById = new Map(channels.map((c) => [c.id, c.name]));
      setVideos((prev) => {
        const existing = new Set(prev.map((v) => v.id));
        const additions: MockVideo[] = [];
        for (const r of results) {
          if (!r) continue;
          for (const v of r.page.videos) {
            if (existing.has(v.id)) continue;
            existing.add(v.id);
            additions.push({
              id: v.id,
              channelId: v.channelId,
              title: v.title,
              thumbnailUrl: v.thumbnailUrl,
              durationSec: v.durationSec,
              uploadedAt: v.uploadedAt,
              views: v.views,
              score: 0.6,
              reason: `Upload from ${channelNameById.get(v.channelId) ?? v.channelName}`,
            });
          }
        }
        return [...prev, ...additions];
      });
      setChannelPaging((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (!r) continue;
          next[r.id] = {
            uploadsPlaylistId: r.page.uploadsPlaylistId,
            nextPageToken: r.page.nextPageToken,
          };
        }
        return next;
      });
    } finally {
      setLoadingMore(false);
    }
  }, [activeChannelIds, channels, channelPaging, fetchUploads, loadingMore]);

  const hasMore = (activeChannelIds.length > 0 ? activeChannelIds : channels.map((c) => c.id)).some(
    (id) => channelPaging[id]?.nextPageToken,
  );


  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  const visibleVideos = useMemo(() => {
    const inc = includeKeywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    const exc = excludeKeywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    let list = videos.filter((v) => {
      if (activeChannelIds.length > 0 && !activeChannelIds.includes(v.channelId)) return false;
      if (hiddenIds.includes(v.id)) return false;
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

    list = [...list].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
    return list;
  }, [
    videos,
    activeChannelIds,
    hiddenIds,
    hideShorts,
    lengthFilter,
    search,
    includeKeywords,
    excludeKeywords,
  ]);

  const hiddenCount = videos.filter((v) => activeChannelIds.includes(v.channelId)).length - visibleVideos.length;

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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setDiscoverOpen(true)}
          >
            <Compass className="h-4 w-4" />
            <span className="hidden sm:inline">Discover</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setHiddenOpen(true)}
            aria-label="Show hidden videos"
            title="Hidden videos"
          >
            <EyeOff className="h-4 w-4" />
            <span className="hidden sm:inline">Hidden</span>
            {hiddenIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {hiddenIds.length}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 lg:px-6">
        {/* Sidebar: My Channels */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">My channels</h2>
              <Badge variant="secondary">{channels.length}</Badge>
            </div>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setDiscoverOpen(true)}
            >
              <Compass className="h-4 w-4" />
              Discover & add channels
            </Button>

            <ScrollArea className="h-[calc(100vh-220px)] pr-2">
              <ul className="space-y-1">
                {channels.map((c) => {
                  const active = activeChannelIds.includes(c.id);
                  const lastVid = videos
                    .filter((v) => v.channelId === c.id)
                    .sort(
                      (a, b) =>
                        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
                    )[0];
                  return (
                    <li key={c.id} className="group flex items-center gap-1">
                      <button
                        onClick={() => toggleChannel(c.id)}
                        className={`flex flex-1 items-center gap-3 rounded-md p-2 text-left transition ${
                          active ? "bg-accent" : "hover:bg-accent/50 opacity-60"
                        }`}
                      >
                        <ChannelAvatar channel={c} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {lastVid ? `Last: ${formatRelative(lastVid.uploadedAt)}` : c.handle}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => removeChannel(c.id)}
                        className="rounded p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
                {channels.length === 0 && (
                  <li className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No channels yet. Use Discover to add some.
                  </li>
                )}
              </ul>
            </ScrollArea>
          </div>
        </aside>

        {/* Main feed */}
        <main className="min-w-0 flex-1">
          {/* Filter chips summary */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
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
                channels={channels}
                onHide={() =>
                  setHiddenIds((prev) =>
                    prev.includes(v.id) ? prev : [...prev, v.id],
                  )
                }
              />
            ))}
            {visibleVideos.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                {channels.length === 0 ? (
                  <>
                    <p className="mb-1 text-base text-foreground">Your feed is empty.</p>
                    <p className="mb-4 text-sm">
                      Add channels from YouTube to start building your personalised feed.
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button onClick={() => setDiscoverOpen(true)}>
                        <Compass className="mr-1.5 h-4 w-4" />
                        Discover channels
                      </Button>
                      <Button variant="outline" onClick={loadSampleData}>
                        Load sample data
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-3">No videos match your filters.</p>
                    <Button variant="outline" size="sm" onClick={() => setDiscoverOpen(true)}>
                      <Compass className="mr-1.5 h-4 w-4" />
                      Find new channels
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Infinite scroll sentinel */}
          {(hasMore || loadingMore) && (
            <div
              ref={sentinelRef}
              className="mt-8 flex items-center justify-center py-6 text-xs text-muted-foreground"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading more videos…
                </span>
              ) : (
                <span>Scroll for more</span>
              )}
            </div>
          )}
        </main>

        {/* Filter rail */}
        {showFilters && (
          <aside className="hidden w-80 shrink-0 xl:block">
            <div className="sticky top-20 space-y-6 rounded-lg border bg-card p-5">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Filters</h3>
              </div>


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
                  Hidden videos
                </div>
                Hide removes a video from your feed.
              </div>
            </div>
          </aside>
        )}
      </div>

      <DiscoverDialog
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
        addedChannelIds={channels.map((c) => c.id)}
        loadingChannelId={loadingChannelId}
        onAdd={addRealChannel}
      />

      <Dialog open={hiddenOpen} onOpenChange={setHiddenOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hidden videos</DialogTitle>
            <DialogDescription>
              {hiddenIds.length === 0
                ? "You haven't hidden any videos yet."
                : `${hiddenIds.length} video${hiddenIds.length === 1 ? "" : "s"} hidden. Unhide to bring them back to your feed.`}
            </DialogDescription>
          </DialogHeader>
          {hiddenIds.length > 0 && (
            <ScrollArea className="max-h-[60vh] pr-3">
              <ul className="space-y-2">
                {videos
                  .filter((v) => hiddenIds.includes(v.id))
                  .map((v) => {
                    const ch = channels.find((c) => c.id === v.channelId);
                    return (
                      <li
                        key={v.id}
                        className="flex items-center gap-3 rounded-md border p-2"
                      >
                        <div
                          className={`relative aspect-video h-16 shrink-0 overflow-hidden rounded-md ${v.thumbnailUrl ? "bg-muted" : `bg-gradient-to-br ${v.thumbnailGradient ?? "from-zinc-700 to-zinc-900"}`}`}
                        >
                          {v.thumbnailUrl && (
                            <img
                              src={v.thumbnailUrl}
                              alt={v.title}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium">
                            {v.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {ch?.name ?? "Unknown channel"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            setHiddenIds((prev) =>
                              prev.filter((id) => id !== v.id),
                            )
                          }
                        >
                          <Eye className="h-4 w-4" />
                          Unhide
                        </Button>
                      </li>
                    );
                  })}
              </ul>
            </ScrollArea>
          )}
          {hiddenIds.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHiddenIds([])}
              >
                Unhide all
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChannelAvatar({
  channel,
  className = "h-9 w-9 text-sm",
}: {
  channel: { name: string; avatar?: string; color?: string; avatarUrl?: string };
  className?: string;
}) {
  if (channel.avatarUrl) {
    return (
      <img
        src={channel.avatarUrl}
        alt={channel.name}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${channel.color ?? "from-zinc-600 to-zinc-800"} ${className}`}
    >
      <span>{channel.avatar ?? channel.name.slice(0, 1)}</span>
    </div>
  );
}

function VideoCard({
  video,
  channels,
  onHide,
}: {
  video: MockVideo;
  channels: MockChannel[];
  onHide: () => void;
}) {
  const channel = channels.find((c) => c.id === video.channelId);
  const [playing, setPlaying] = useState(false);
  if (!channel) return null;
  return (
    <article className="group overflow-hidden rounded-xl border bg-card transition hover:border-foreground/20 hover:shadow-lg">
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="block w-full text-left"
      >
        <div
          className={`relative aspect-video w-full overflow-hidden ${video.thumbnailUrl ? "bg-muted" : `bg-gradient-to-br ${video.thumbnailGradient ?? "from-zinc-700 to-zinc-900"}`}`}
        >
          {video.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(video.durationSec)}
          </span>
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
            <Sparkles className="h-3 w-3" />
            {Math.round(video.score * 100)}% match
          </span>
        </div>
      </button>

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <ChannelAvatar channel={channel} />
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
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={onHide}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hide
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setPlaying(true)}
          >
            Watch
          </Button>
        </div>
      </div>

      <Dialog open={playing} onOpenChange={setPlaying}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{video.title}</DialogTitle>
            <DialogDescription>{channel.name}</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video w-full">
            {playing && (
              <iframe
                src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
                title={video.title}
                className="absolute inset-0 h-full w-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-3 bg-card p-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{video.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {channel.name} · {formatViews(video.views)} · {formatRelative(video.uploadedAt)}
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open on YouTube
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function DiscoverDialog({
  open,
  onOpenChange,
  addedChannelIds,
  loadingChannelId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  addedChannelIds: string[];
  loadingChannelId: string | null;
  onAdd: (ch: YTChannel) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [channels, setChannels] = useState<YTChannel[]>([]);
  const [videos, setVideos] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchChannels = useServerFn(searchYouTubeChannels);
  const searchVideos = useServerFn(searchYouTubeVideos);

  // Debounced live search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setChannels([]);
      setVideos([]);
      setSubmitted("");
      setError(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setSubmitted(q);
      try {
        const [ch, vd] = await Promise.all([
          searchChannels({ data: { query: q } }),
          searchVideos({ data: { query: q } }),
        ]);
        setChannels(
          [...ch].sort(
            (a, b) => (b.subscribers ?? 0) - (a.subscribers ?? 0),
          ),
        );
        setVideos(vd);
      } catch (e: any) {
        setError(e?.message ?? "Search failed");
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [query, searchChannels, searchVideos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5" />
            Discover on YouTube
          </DialogTitle>
          <DialogDescription>
            Search the live YouTube catalog. Add a channel and its latest uploads
            land in your feed instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YouTube channels and videos…"
            className="pl-9"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="channels" className="gap-1.5">
              <Users className="h-4 w-4" />
              Search for channels ({channels.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5">
              <Youtube className="h-4 w-4" />
              Search for channels based on videos ({videos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="mt-4">
            <ScrollArea className="h-[420px] pr-3">
              <ul className="space-y-2">
                {channels.map((c) => {
                  const added = addedChannelIds.includes(c.id);
                  const busy = loadingChannelId === c.id;
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-lg border bg-card p-3"
                    >
                      <ChannelAvatar channel={c} className="h-11 w-11 text-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold">{c.name}</div>
                          {c.handle && (
                            <span className="truncate text-xs text-muted-foreground">
                              {c.handle.startsWith("@") ? c.handle : `@${c.handle}`}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatSubs(c.subscribers)}
                        </div>
                        {c.topics && c.topics.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {c.topics.map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px]">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={added ? "secondary" : "outline"}
                        className="shrink-0 gap-1.5 self-center"
                        disabled={added || busy}
                        onClick={() => onAdd(c)}
                      >
                        {added ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Added
                          </>
                        ) : busy ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Adding…
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            Add channel
                          </>
                        )}
                      </Button>
                    </li>
                  );
                })}
                {!loading && submitted && channels.length === 0 && (
                  <li className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No channels match "{submitted}".
                  </li>
                )}
                {!submitted && (
                  <li className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    ​
                  </li>
                )}
              </ul>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="videos" className="mt-4">
            <ScrollArea className="h-[420px] pr-3">
              <ul className="space-y-2">
                {videos.map((v) => {
                  const added = addedChannelIds.includes(v.channelId);
                  const busy = loadingChannelId === v.channelId;
                  return (
                    <li key={v.id} className="flex gap-3 rounded-lg border bg-card p-3">
                      <a
                        href={`https://www.youtube.com/watch?v=${v.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="relative aspect-video h-20 shrink-0 overflow-hidden rounded-md bg-muted"
                      >
                        {v.thumbnailUrl && (
                          <img
                            src={v.thumbnailUrl}
                            alt={v.title}
                            className="h-full w-full object-cover"
                          />
                        )}
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
                          {formatDuration(v.durationSec)}
                        </span>
                      </a>
                      <div className="min-w-0 flex-1">
                        <h4 className="line-clamp-2 text-sm font-semibold leading-snug">
                          {v.title}
                        </h4>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="truncate">{v.channelName}</span>
                          <span>·</span>
                          <span>{formatRelative(v.uploadedAt)}</span>
                          <span>·</span>
                          <span>{formatViews(v.views)}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={added ? "secondary" : "outline"}
                        className="shrink-0 gap-1.5 self-center"
                        disabled={added || busy}
                        onClick={() =>
                          onAdd({
                            id: v.channelId,
                            name: v.channelName,
                            handle: "",
                            avatarUrl: v.channelAvatarUrl ?? "",
                          })
                        }
                      >
                        {added ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Added
                          </>
                        ) : busy ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Adding…
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            Add channel
                          </>
                        )}
                      </Button>
                    </li>
                  );
                })}
                {!loading && submitted && videos.length === 0 && (
                  <li className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No videos match "{submitted}".
                  </li>
                )}
                {!submitted && (
                  <li className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    ​
                  </li>
                )}
              </ul>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
