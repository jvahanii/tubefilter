## Signup: show-password toggle + confirm password

Edit `src/components/auth-gate.tsx` only.

### Changes

1. **Show/hide password toggle**
   - Add `showPassword` state (boolean).
   - Wrap the password `Input` in a relative container with an `Eye` / `EyeOff` icon button (lucide-react) positioned on the right.
   - Toggle the input `type` between `"password"` and `"text"`.
   - Apply to both signin and signup (single shared field), and to the new confirm field.

2. **Confirm password (signup only)**
   - Add `confirmPassword` state.
   - Render a second `Input` labeled "Confirm password" only when `mode === "signup"`.
   - Include the same show/hide toggle.

3. **Validation on submit (signup only)**
   - If `password !== confirmPassword`, set `error` to "Passwords do not match" and abort before calling `signUp`.
   - Keep existing `minLength={6}` on both fields.

4. **State reset**
   - Clear `confirmPassword` and `showPassword` when switching tabs via `setMode` to avoid stale values leaking between flows.

No backend/auth logic changes — `signUp(email, password)` signature stays the same.
