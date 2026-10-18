import { LogoMark } from "@/components/Logo";

export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading">
      <LogoMark size={56} className="animate-wiggle" />
    </div>
  );
}
