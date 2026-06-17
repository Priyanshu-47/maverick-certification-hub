"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search as SearchIcon, FolderKanban, Users, Ticket, ArrowRight } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
import { PageHeader, StatusBadge } from "@/components/shared";

type SearchResult = {
  type: "drive" | "registration" | "voucher";
  id: string;
  title: string;
  subtitle: string;
  status: string;
  href: string;
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [searched, setSearched] = useState(!!initialQuery);

  useEffect(() => {
    if (initialQuery.trim()) {
      setSearched(true);
      startTransition(async () => {
        const res = await fetch(`/api/search?q=${encodeURIComponent(initialQuery.trim())}`);
        const data = await res.json();
        setResults(data.results || []);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearched(true);
    startTransition(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
    });
  };

  const ICONS: Record<string, React.ElementType> = { drive: FolderKanban, registration: Users, voucher: Ticket };

  return (
    <div>
      <PageHeader title="Search" description="Search drives, candidates, and vouchers" />

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full h-11 rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search by name, ID, email, or keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <Button type="submit" disabled={isPending || !query.trim()}>
          {isPending ? "Searching..." : "Search"}
        </Button>
      </form>

      {searched && !isPending && results.length === 0 && (
        <Card className="p-8 text-center">
          <SearchIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No results found for &quot;{query}&quot;</p>
          <p className="text-xs text-slate-400 mt-1">Try searching by name, employee ID, drive code, or email</p>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 mb-3">{results.length} result{results.length !== 1 ? "s" : ""} found</p>
          {results.map((r) => {
            const Icon = ICONS[r.type] || FolderKanban;
            return (
              <Link key={`${r.type}-${r.id}`} href={r.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer mb-2">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-slate-100 shrink-0">
                      <Icon className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{r.title}</p>
                      <p className="text-sm text-slate-500 truncate">{r.subtitle}</p>
                    </div>
                    <StatusBadge status={r.status} />
                    <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
