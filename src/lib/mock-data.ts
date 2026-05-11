export type MockChannel = {
  id: string;
  name: string;
  handle: string;
  avatar?: string; // emoji placeholder (mock)
  color?: string; // gradient (mock)
  avatarUrl?: string; // real channel thumbnail
  subscribers?: number;
  topics?: string[];
};

export type MockVideo = {
  id: string;
  channelId: string;
  title: string;
  thumbnailGradient?: string; // mock
  thumbnailUrl?: string; // real
  durationSec: number;
  uploadedAt: string; // ISO
  views: number;
  score: number; // personalization score 0-1
  reason: string;
};

export const mockChannels: MockChannel[] = [
  { id: "c1", name: "Fireship", handle: "@fireship", avatar: "🔥", color: "from-orange-500 to-red-600", subscribers: 3_400_000, topics: ["webdev", "javascript", "ai"] },
  { id: "c2", name: "Veritasium", handle: "@veritasium", avatar: "🧪", color: "from-blue-500 to-cyan-600", subscribers: 16_800_000, topics: ["science", "physics"] },
  { id: "c3", name: "Kurzgesagt", handle: "@kurzgesagt", avatar: "🐦", color: "from-amber-400 to-pink-500", subscribers: 22_100_000, topics: ["science", "explainer"] },
  { id: "c4", name: "MKBHD", handle: "@mkbhd", avatar: "📱", color: "from-zinc-700 to-zinc-900", subscribers: 19_500_000, topics: ["tech", "reviews"] },
  { id: "c5", name: "Acquired", handle: "@acquired", avatar: "📈", color: "from-emerald-500 to-teal-700", subscribers: 480_000, topics: ["business", "tech"] },
  { id: "c6", name: "Tom Scott", handle: "@tomscott", avatar: "🎒", color: "from-red-500 to-rose-700", subscribers: 6_700_000, topics: ["geography", "explainer"] },
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

// ============= Discover pool (NOT yet in My Feed) =============
// Simulates results that come back from "searching YouTube".

export const discoverChannels: MockChannel[] = [
  { id: "d1", name: "Theo - t3.gg", handle: "@t3dotgg", avatar: "⚡", color: "from-violet-500 to-fuchsia-700", subscribers: 410_000, topics: ["webdev", "typescript", "react"] },
  { id: "d2", name: "Lex Fridman", handle: "@lexfridman", avatar: "🎙️", color: "from-slate-600 to-slate-900", subscribers: 4_900_000, topics: ["interviews", "ai", "science"] },
  { id: "d3", name: "Two Minute Papers", handle: "@twominutepapers", avatar: "📄", color: "from-cyan-500 to-blue-700", subscribers: 1_600_000, topics: ["ai", "research", "science"] },
  { id: "d4", name: "LegalEagle", handle: "@legaleagle", avatar: "⚖️", color: "from-yellow-500 to-amber-700", subscribers: 3_200_000, topics: ["law", "explainer"] },
  { id: "d5", name: "Wendover Productions", handle: "@wendover", avatar: "✈️", color: "from-sky-600 to-indigo-800", subscribers: 4_500_000, topics: ["geography", "logistics", "explainer"] },
  { id: "d6", name: "ThePrimeagen", handle: "@theprimeagen", avatar: "⌨️", color: "from-emerald-500 to-green-800", subscribers: 720_000, topics: ["webdev", "vim", "typescript"] },
  { id: "d7", name: "Marques on Cars", handle: "@marquescars", avatar: "🚗", color: "from-red-600 to-zinc-900", subscribers: 1_200_000, topics: ["tech", "cars", "reviews"] },
  { id: "d8", name: "PolyMatter", handle: "@polymatter", avatar: "🌐", color: "from-teal-500 to-emerald-800", subscribers: 1_900_000, topics: ["geopolitics", "business", "explainer"] },
];

export const discoverVideos: (MockVideo & { channelName: string; channelAvatar: string; channelColor: string })[] = [
  { id: "dv1", channelId: "d1", channelName: "Theo - t3.gg", channelAvatar: "⚡", channelColor: "from-violet-500 to-fuchsia-700", title: "Why everyone is rewriting their stack in 2026", thumbnailGradient: "from-violet-500 via-fuchsia-600 to-pink-700", durationSec: 845, uploadedAt: h(8), views: 220_000, score: 0.7, reason: "Trending in webdev" },
  { id: "dv2", channelId: "d3", channelName: "Two Minute Papers", channelAvatar: "📄", channelColor: "from-cyan-500 to-blue-700", title: "This new AI model just broke everyone's benchmarks", thumbnailGradient: "from-cyan-500 via-blue-600 to-indigo-800", durationSec: 312, uploadedAt: h(14), views: 480_000, score: 0.74, reason: "Matches AI interest" },
  { id: "dv3", channelId: "d5", channelName: "Wendover Productions", channelAvatar: "✈️", channelColor: "from-sky-600 to-indigo-800", title: "How airlines decide which routes are worth flying", thumbnailGradient: "from-sky-500 via-indigo-600 to-violet-800", durationSec: 1124, uploadedAt: h(36), views: 1_100_000, score: 0.65, reason: "Similar to Tom Scott" },
  { id: "dv4", channelId: "d2", channelName: "Lex Fridman", channelAvatar: "🎙️", channelColor: "from-slate-600 to-slate-900", title: "A 4 hour conversation about the future of programming", thumbnailGradient: "from-slate-600 via-slate-800 to-black", durationSec: 14_320, uploadedAt: h(60), views: 980_000, score: 0.55, reason: "Long-form interview" },
  { id: "dv5", channelId: "d6", channelName: "ThePrimeagen", channelAvatar: "⌨️", channelColor: "from-emerald-500 to-green-800", title: "I tried Zed for a month — honest thoughts", thumbnailGradient: "from-emerald-500 via-green-700 to-teal-900", durationSec: 1872, uploadedAt: h(18), views: 165_000, score: 0.68, reason: "Editor / dev tools" },
  { id: "dv6", channelId: "d8", channelName: "PolyMatter", channelAvatar: "🌐", channelColor: "from-teal-500 to-emerald-800", title: "Why TSMC is the most important company on Earth", thumbnailGradient: "from-teal-500 via-emerald-700 to-slate-900", durationSec: 980, uploadedAt: h(50), views: 740_000, score: 0.6, reason: "Business / tech explainer" },
  { id: "dv7", channelId: "d4", channelName: "LegalEagle", channelAvatar: "⚖️", channelColor: "from-yellow-500 to-amber-700", title: "The lawsuit that could break the internet, explained", thumbnailGradient: "from-yellow-500 via-amber-600 to-orange-800", durationSec: 1340, uploadedAt: h(28), views: 890_000, score: 0.5, reason: "Trending explainer" },
  { id: "dv8", channelId: "d7", channelName: "Marques on Cars", channelAvatar: "🚗", channelColor: "from-red-600 to-zinc-900", title: "The first truly good electric sports car?", thumbnailGradient: "from-red-600 via-rose-700 to-zinc-900", durationSec: 760, uploadedAt: h(40), views: 410_000, score: 0.52, reason: "Tech reviews" },
];
