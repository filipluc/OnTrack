import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login as loginApi } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await loginApi(email, password);
      login(token, user);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>OnTrack</h1>
        <p className="subtitle">Log in to see your schedule</p>
        {error && <p className="error">{error}</p>}
        <label>
          Email
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
        <p className="switch-link">
          New parent? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
