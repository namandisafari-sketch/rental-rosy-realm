import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandMenu } from "@/components/command-menu";
import { getWorkspace } from "@/lib/workspace-config";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const role = useHighestRole();
  const ws = getWorkspace(role);
  const nav = useNavigate();
  const WsIcon = ws.icon;

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading your portal…</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full" data-workspace={role ?? "admin"}>
        <style>{`
          [data-workspace="${role ?? "admin"}"] {
            --ws-accent: ${ws.accent};
            --ws-accent-foreground: ${ws.accentForeground};
            --ws-accent-light: ${ws.accentLight};
          }
        `}</style>
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header
            className="flex h-14 items-center gap-3 border-b px-4 backdrop-blur"
            style={{ borderColor: "var(--color-border)", background: "var(--color-background)" }}
          >
            <SidebarTrigger />
            <CommandMenu />
            <div className="ml-auto flex items-center gap-3 text-sm">
              <div
                className="hidden items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider sm:inline-flex"
                style={{ background: ws.accentLight, color: ws.accent }}
              >
                <WsIcon className="h-3 w-3" />
                {ws.name}
              </div>
              <span className="text-muted-foreground">{ws.badge}</span>
            </div>
          </header>
          <main className="flex-1 bg-secondary/30 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
