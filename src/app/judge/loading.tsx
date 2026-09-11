import { PageSkeleton } from "@/components/ui/states";

// Judges' pages are lists and score forms — no stat row, just the content.
export default function JudgeLoading() {
  return <PageSkeleton stats={false} rows={6} />;
}
