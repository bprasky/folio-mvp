import { UpdatesCard } from "./UpdatesCard";

export function UpdatesFeed({ modules }: { modules: any[] }) {
  if (!modules?.length) {
    return (
      <p className="text-sm text-folio-text-secondary">
        No updates yet. As designers share stories, renders, and clips, they'll appear here.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {modules.map((m) => (
        <UpdatesCard key={m.id} module={m} />
      ))}
    </div>
  );
}


