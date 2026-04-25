import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message ?? "Terjadi error yang tidak terduga.",
    };
  }

  componentDidCatch(error) {
    console.error("Choky dashboard runtime error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <div className="w-full max-w-lg rounded-[2rem] border border-rose-200 bg-white p-8 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">Runtime Error</p>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">Halaman gagal dimuat setelah login</h1>
            <p className="mt-3 text-sm text-slate-600">
              Aplikasi menangkap error di sisi browser. Refresh halaman sekali lagi, lalu kalau masih terjadi buka DevTools
              Console untuk melihat pesan detail.
            </p>
            <pre className="mt-4 overflow-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="mt-5 rounded-2xl bg-navy px-4 py-2 text-sm font-semibold text-white"
            >
              Coba Muat Ulang Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
