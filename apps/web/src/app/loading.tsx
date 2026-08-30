import { LoadingState } from "@playora/ui";

/** Route-level loading state, shown while a page's data resolves. */
export default function Loading() {
  return <LoadingState title="Loading" hint="Getting things ready…" className="min-h-[70vh]" />;
}
