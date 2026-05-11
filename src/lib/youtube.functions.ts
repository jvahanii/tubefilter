import { createServerFn } from "@tanstack/react-start";

const API = "https://www.googleapis.com/youtube/v3";

function key() {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY is not configured");
  return k;
}

// ISO 8601 duration -> seconds (PT1H2M3S)
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

async function yt<T = any>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key());
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export type YTChannel = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  subscribers?: number;
  topics?: string[];
  description?: string;
};

export type YTVideo = {
  id: string;
  channelId: string;
  channelName: string;
  channelAvatarUrl?: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  uploadedAt: string;
  views: number;
};

// Search channels
export const searchYouTubeChannels = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }): Promise<YTChannel[]> => {
    const q = data.query.trim();
    if (!q) return [];
    const search = await yt<any>("search", {
      part: "snippet",
      type: "channel",
      maxResults: "12",
      q,
    });
    const ids = (search.items ?? [])
      .map((i: any) => i.snippet?.channelId ?? i.id?.channelId)
      .filter(Boolean)
      .join(",");
    if (!ids) return [];
    const details = await yt<any>("channels", {
      part: "snippet,statistics,topicDetails",
      id: ids,
    });
    return (details.items ?? []).map((c: any): YTChannel => ({
      id: c.id,
      name: c.snippet?.title ?? "",
      handle: c.snippet?.customUrl ?? "",
      avatarUrl:
        c.snippet?.thumbnails?.medium?.url ??
        c.snippet?.thumbnails?.default?.url ??
        "",
      subscribers: c.statistics?.subscriberCount
        ? Number(c.statistics.subscriberCount)
        : undefined,
      description: c.snippet?.description ?? "",
      topics: (c.topicDetails?.topicCategories ?? [])
        .map((u: string) => u.split("/").pop()?.replace(/_/g, " ").toLowerCase() ?? "")
        .filter(Boolean)
        .slice(0, 4),
    }));
  });

// Search videos
export const searchYouTubeVideos = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }): Promise<YTVideo[]> => {
    const q = data.query.trim();
    if (!q) return [];
    const search = await yt<any>("search", {
      part: "snippet",
      type: "video",
      maxResults: "12",
      q,
    });
    const ids = (search.items ?? [])
      .map((i: any) => i.id?.videoId)
      .filter(Boolean)
      .join(",");
    if (!ids) return [];
    return enrichVideos(ids);
  });

export type ChannelUploadsPage = {
  videos: YTVideo[];
  uploadsPlaylistId: string;
  nextPageToken: string | null;
};

// Get a page of a channel's uploads. Pass uploadsPlaylistId on subsequent
// calls to skip the channel lookup, and pageToken to paginate.
export const getChannelUploads = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      channelId: string;
      max?: number;
      pageToken?: string;
      uploadsPlaylistId?: string;
    }) => d,
  )
  .handler(async ({ data }): Promise<ChannelUploadsPage> => {
    let uploadsPid = data.uploadsPlaylistId;
    if (!uploadsPid) {
      const ch = await yt<any>("channels", {
        part: "contentDetails",
        id: data.channelId,
      });
      uploadsPid = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    }
    if (!uploadsPid) {
      return { videos: [], uploadsPlaylistId: "", nextPageToken: null };
    }
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId: uploadsPid,
      maxResults: String(Math.min(data.max ?? 15, 50)),
    };
    if (data.pageToken) params.pageToken = data.pageToken;
    const items = await yt<any>("playlistItems", params);
    const ids = (items.items ?? [])
      .map((i: any) => i.contentDetails?.videoId)
      .filter(Boolean)
      .join(",");
    const videos = ids ? await enrichVideos(ids) : [];
    return {
      videos,
      uploadsPlaylistId: uploadsPid,
      nextPageToken: items.nextPageToken ?? null,
    };
  });

async function enrichVideos(ids: string): Promise<YTVideo[]> {
  const vids = await yt<any>("videos", {
    part: "snippet,contentDetails,statistics",
    id: ids,
  });
  return (vids.items ?? []).map((v: any): YTVideo => ({
    id: v.id,
    channelId: v.snippet?.channelId ?? "",
    channelName: v.snippet?.channelTitle ?? "",
    title: v.snippet?.title ?? "",
    thumbnailUrl:
      v.snippet?.thumbnails?.medium?.url ??
      v.snippet?.thumbnails?.high?.url ??
      v.snippet?.thumbnails?.default?.url ??
      "",
    durationSec: parseDuration(v.contentDetails?.duration ?? "PT0S"),
    uploadedAt: v.snippet?.publishedAt ?? new Date().toISOString(),
    views: Number(v.statistics?.viewCount ?? 0),
  }));
}
