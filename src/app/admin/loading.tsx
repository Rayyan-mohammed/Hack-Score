import { PageSkeleton } from "@/components/ui/states";

// Shown the moment an admin page is opened, while its data loads. The sidebar
// and header stay put (they live in the layout); only the page area swaps.
export default function AdminLoading() {
  return <PageSkeleton />;
}
