import Dashboard from "./components/Dashboard";

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white px-5 py-3">
        <h1 className="text-lg font-bold tracking-tight">
          Hyperlocal: best Austin zip codes, by business type
        </h1>
        <p className="text-sm text-zinc-500">
          17 central Austin zips scored on local demand, competition, and foot traffic, using real Census and Google Maps data.
        </p>
      </header>
      <Dashboard />
    </div>
  );
}
