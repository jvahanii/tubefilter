export type MockChannel = {
  id: string;
  name: string;
  handle: string;
  avatar: string; // emoji as placeholder
  color: string;
};

export type MockVideo = {
  id: string;
  channelId: string;
  title: string;
  thumbnailGradient: string;
  durationSec: number;
  uploadedAt: string; // ISO
  views: number;
  score: number; // personalization score 0-1
  reason: string;
};

export const mockChannels: MockChannel[] = [
  { id: "c1", name: "Fireship", handle: "@fireship", avatar: "🔥", color: "from-orange-500 to-red-600" },
  { id: "c2", name: "Veritasium", handle: "@veritasium", avatar: "🧪", color: "from-blue-500 to-cyan-600" },
  { id: "c3", name: "Kurzgesagt", handle: "@kurzgesagt", avatar: "🐦", color: "from-amber-400 to-pink-500" },
  { id: "c4", name: "MKBHD", handle: "@mkbhd", avatar: "📱", color: "from-zinc-700 to-zinc-900" },
  { id: "c5", name: "Acquired", handle: "@acquired", avatar: "📈", color: "from-emerald-500 to-teal-700" },
  { id: "c6", name: "Tom Scott", handle: "@tomscott", avatar: "🎒", color: "from-red-500 to-rose-700" },
];

const now = Date.now();
const h = (n: number) => new Date(now - n * 3600 * 1000).toISOString();

export const mockVideos: MockVideo[] = [
  { id: "v1", channelId: "c1", title: "I tried 10 new JavaScript frameworks so you don't have to", thumbnailGradient: "from-orange-500 via-red-500 to-purple-700", durationSec: 412, uploadedAt: h(2), views: 184_000, score: 0.94, reason: "Matches your interest in web dev" },
  { id: "v2", channelId: "c2", title: "The strange physics of why planes don't actually fly the way you think", thumbnailGradient: "from-sky-500 via-blue-600 to-indigo-800", durationSec: 1287, uploadedAt: h(5), views: 920_000, score: 0.88, reason: "You watched 3 similar videos" },
  { id: "v3", channelId: "c3", title: "What if we drained the Mediterranean Sea?", thumbnailGradient: "from-amber-400 via-pink-500 to-fuchsia-700", durationSec: 738, uploadedAt: h(20), views: 2_100_000, score: 0.81, reason: "From a channel you like" },
  { id: "v4", channelId: "c4", title: "The iPhone 18 Pro Review: Quietly the biggest jump yet", thumbnailGradient: "from-zinc-700 via-zinc-800 to-black", durationSec: 1056, uploadedAt: h(30), views: 4_400_000, score: 0.77, reason: "Recent upload from MKBHD" },
  { id: "v5", channelId: "c5", title: "Nvidia: How a graphics card company became a $5T monster", thumbnailGradient: "from-emerald-500 via-teal-600 to-slate-800", durationSec: 9842, uploadedAt: h(48), views: 612_000, score: 0.71, reason: "You upvoted 2 long-form deep dives" },
  { id: "v6", channelId: "c6", title: "The tiny island that owns half the world's flags", thumbnailGradient: "from-rose-500 via-red-600 to-amber-700", durationSec: 524, uploadedAt: h(72), views: 1_800_000, score: 0.66, reason: "Tom Scott — new upload" },
  { id: "v7", channelId: "c1", title: "Bun 2.0 in 100 seconds", thumbnailGradient: "from-yellow-400 via-orange-500 to-red-600", durationSec: 112, uploadedAt: h(96), views: 380_000, score: 0.62, reason: "Short and matches your topics" },
  { id: "v8", channelId: "c2", title: "We measured the speed of dark — here's what happened", thumbnailGradient: "from-indigo-700 via-purple-800 to-black", durationSec: 1612, uploadedAt: h(120), views: 1_300_000, score: 0.59, reason: "Science explainer" },
];
