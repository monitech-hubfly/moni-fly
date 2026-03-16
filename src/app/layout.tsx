import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Viabilidade Moní | Casa Moní",
  description: "Ferramenta de viabilidade e análise de praça para franqueados Casa Moní. Da praça à hipótese em PDF.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user: { id: string; email?: string; full_name?: string | null } | null = null;
  let userRole = "frank";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
    if (user?.id) {
      const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
      userRole = (profile?.role as string) ?? "frank";
      (user as { full_name?: string | null }).full_name = profile?.full_name ?? null;
    }
  } catch {
    // ignore
  }

  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <AppShell user={user} userRole={userRole}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
