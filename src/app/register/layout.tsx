import { Footer } from "@/components/footer";

// Public, unauthenticated shell — same shape as the results pages: no sidebar,
// just the page and the full footer.
export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
