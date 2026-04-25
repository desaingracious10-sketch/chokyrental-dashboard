export default function PagePlaceholder({ title, description }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
      <h2 className="text-xl font-bold text-navy">{title}</h2>
      <p className="text-sm text-slate-500 mt-1">
        {description ?? "Halaman ini akan dibangun pada langkah selanjutnya."}
      </p>
    </div>
  );
}
