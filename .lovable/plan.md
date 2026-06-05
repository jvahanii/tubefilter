## Remove "More like this" button and all thumbs-up logic

Edit `src/routes/index.tsx`:

1. **VideoCard** — remove the "More like this" `<Button>` (lines 819-827). Drop `vote` and `onVote` props, remove `ThumbsUp` icon usage. Hide button calls a simpler `onHide` callback instead.
2. **Imports** — remove `ThumbsUp` and `ThumbsDown` from lucide-react imports.
3. **Feed page** — replace the `votes` state with a simpler `hiddenIds: string[]` (or `Set<string>`). Update:
   - `useState` declaration
   - Supabase hydration (`parsed.votes` → `parsed.hiddenIds`)
   - Supabase persistence payload (`votes` → `hiddenIds`)
   - `visibleVideos` filter: `if (hiddenIds.includes(v.id)) return false;`
   - Remove the `votes[id] === "up"` boost branch in the `for-you` sort
4. **Sort dropdown** — remove the "For you" `<SelectItem>` and narrow the `sort` state type to just `"recent"` (or drop the Select entirely since only one option remains). I'll drop the Select to keep the header clean.
5. **Filter rail** — remove the "Learning from you / Thumbs up boosts…" info block (lines 706-712) since there's no learning anymore.
6. **VideoCard call site** — pass `onHide={() => setHiddenIds(prev => [...prev, v.id])}` and `hidden={hiddenIds.includes(v.id)}` (so the Hide button can still toggle visually if needed; actually since hidden videos disappear from the list, the toggle state isn't visible — Hide just removes).

### Migration note
Existing rows in `user_preferences.data.votes` will simply be ignored. Down-votes won't auto-migrate to `hiddenIds`. If you want me to migrate existing `votes[id] === "down"` entries into `hiddenIds` on hydration, say so and I'll add a one-time conversion.

No DB schema changes needed — `data` is JSON.