import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, MapPinned, BarChart3, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import lpsoLogo from "../data/lpso_logo.png";


export default function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter both your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    const res = await login(email, password);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
    }
    // On success, AuthContext's onAuthStateChange listener updates
    // isAuthenticated and App.jsx swaps away from this view automatically.
  }

  return (
    <div className="admin-auth">
      <img className="admin-auth-watermark" src={lpsoLogo} alt="" aria-hidden="true" />

      {/* Left: brand / marketing panel — matches the motorist portal's login layout */}
      <div className="admin-auth-art">
        <div className="admin-auth-brand">
          <div className="admin-auth-crest">
            <img src={lpsoLogo} alt="LPSO logo" />
          </div>
          <div>
            <strong style={{ color: "#fff" }}>eTicket</strong>
            <span>Libmanan Public Safety Office</span>
          </div>
        </div>

        <div className="admin-auth-copy">
          <div className="admin-auth-eyebrow">ADMIN CONSOLE</div>
          <h1 style={{ color: "#fff" }}>
            Traffic enforcement,
            <br />
            coordinated in one place.
          </h1>
          <p>
            Sign in to manage citations, monitor hotspots, and coordinate enforcers
            across Libmanan in real time.
          </p>
          <div className="admin-auth-points">
            <span><MapPinned size={17} /> Geospatial hotspot mapping</span>
            <span><BarChart3 size={17} /> Real-time citation monitoring</span>
            <span><ShieldCheck size={17} /> Secure admin access</span>
          </div>
        </div>

        <div className="admin-auth-foot">© 2026 Libmanan Public Safety Office • eTicket</div>
      </div>

      {/* Right: floating login card */}
      <div className="admin-auth-panel">
        <div className="admin-login-box">
          <div className="admin-login-icon">
            <img src={lpsoLogo} alt="LPSO logo" />
          </div>
          <h2>Welcome back</h2>
          <p>Use your LPSO admin console credentials to continue.</p>

          <form onSubmit={handleSubmit}>
            <label>
              Email
              <div className="field-wrap">
                <Mail size={15} className="field-icon" />
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@lpso.gov.ph"
                  autoComplete="email"
                />
              </div>
            </label>

            <label>
              Password
              <div className="field-wrap">
                <Lock size={15} className="field-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your admin password"
                  autoComplete="current-password"
                  style={{ paddingRight: 36 }}
                />
                {showPassword
                  ? <EyeOff size={15} className="field-toggle" onClick={() => setShowPassword(false)} aria-label="Hide password" />
                  : <Eye size={15} className="field-toggle" onClick={() => setShowPassword(true)} aria-label="Show password" />}
              </div>
            </label>

            <div className="admin-login-row">
              <label>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                Keep me signed in
              </label>
              <span>Forgot password?</span>
            </div>

            {error && (
              <div className="admin-form-error">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button type="submit" className="admin-login-primary" disabled={loading}>
              {loading ? <Loader2 size={15} className="et-scan-line" /> : null}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="admin-login-privacy">
            <ShieldCheck size={14} /> Access is limited to authorized LPSO enforcement personnel.
          </div>
        </div>
      </div>
    </div>
  );
}
