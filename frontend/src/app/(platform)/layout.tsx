import { AppShell } from "@/components/layout/AppShell";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
