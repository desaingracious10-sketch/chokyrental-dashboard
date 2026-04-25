import { useState } from "react";
import { Car, Lock, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, pushToast } = useAppContext();
  const [form, setForm] = useState({ username: "admin", password: "choky2025" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const valid = login(form.username, form.password);
    setLoading(false);

    if (!valid) {
      pushToast({
        type: "error",
        title: "Login gagal",
        message: "Username atau password tidak sesuai.",
      });
      return;
    }

    pushToast({
      type: "success",
      title: "Login berhasil",
      message: "Selamat datang di Choky Rental Command Center.",
    });
    navigate(location.state?.from ?? "/", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(0,184,169,0.28),_transparent_35%),linear-gradient(135deg,#081633,#0d1f4e_55%,#00b8a9)] p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-white/10 p-8 text-white shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15">
          <Car className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-center text-3xl font-bold">Choky Rental</h1>
        <p className="mt-2 text-center text-sm text-white/70">Masuk ke Command Center untuk memulai presentasi dashboard.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/80">Username</span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4">
              <User className="h-4 w-4 text-white/70" />
              <input
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                className="h-12 w-full bg-transparent outline-none placeholder:text-white/45"
                placeholder="admin"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/80">Password</span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4">
              <Lock className="h-4 w-4 text-white/70" />
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="h-12 w-full bg-transparent outline-none placeholder:text-white/45"
                placeholder="choky2025"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-white font-semibold text-navy transition hover:bg-slate-100 disabled:opacity-70"
          >
            {loading ? "Masuk..." : "Masuk ke Dashboard"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-white/55">Default demo login: admin / choky2025</p>
      </div>
    </div>
  );
}
