import { useState, type FormEvent } from "react";
import { resetChildPassword } from "../api";
import { useEscapeKey } from "../useEscapeKey";

export default function ResetPasswordDialog({
  childId,
  childName,
  onDone,
  onCancel,
}: {
  childId: number;
  childName: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEscapeKey(onCancel);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await resetChildPassword(childId, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Reset password for {childName}</h2>
        {error && <p className="error">{error}</p>}
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Reset password"}
          </button>
        </div>
      </form>
    </div>
  );
}
