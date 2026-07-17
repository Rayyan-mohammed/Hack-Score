import Link from "next/link";
import { Brand } from "@/components/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-12">
      {/* Ambient accent wash behind the auth card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-violet/20 blur-[100px]" />
        <div className="absolute -bottom-32 left-1/2 h-64 w-[28rem] -translate-x-1/2 rounded-full bg-cyan/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in-up">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center rounded-xl"
        >
          <Brand size="lg" />
        </Link>
        {children}
      </div>
    </div>
  );
}
