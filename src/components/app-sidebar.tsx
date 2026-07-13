import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, ChevronDown } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { getWorkspace, type NavGroup } from "@/lib/workspace-config";
import { useAllFeatureAccess } from "@/hooks/use-feature-access";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { useState } from "react";
import logoSrc from "@/assets/habico-logo.jpg";

function NavGroup({ label, items }: { label: string; items: { title: string; url: string; icon: any }[] }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const initiallyOpen = items.some((it) => path === it.url || (it.url !== "/dashboard" && path.startsWith(it.url)));
  const [open, setOpen] = useState(initiallyOpen);
  const isActive = (url: string) => path === url || (url !== "/dashboard" && path.startsWith(url));
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="flex cursor-pointer items-center justify-between">
            <span>{label}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)}>
                    <Link to={it.url}>
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar() {
  const role = useHighestRole();
  const { user, signOut } = useAuth();
  const ws = getWorkspace(role);
  const features = useAllFeatureAccess();
  const WsIcon = ws.icon;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => path === url || (url !== "/dashboard" && path.startsWith(url));
  const isStaff = role === "admin" || role === "manager";

  function groupVisible(g: NavGroup) {
    if (!g.feature) return true;
    if (isStaff) return true;
    return features[g.feature] === true;
  }

  function itemVisible(it: { feature?: string }) {
    if (!it.feature) return true;
    if (isStaff) return true;
    return features[it.feature] === true;
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className="border-b border-sidebar-border"
        style={{ background: ws.sidebarHeaderBg }}
      >
        <Link to={ws.defaultRoute} className="flex items-center gap-2 p-2">
          <img src={logoSrc} alt="Habico" className="h-8 w-8 rounded-md object-cover" />
          <div className="leading-tight">
            <div className="display text-sm font-bold text-sidebar-foreground">HABICO</div>
            <div
              className="text-[9px] font-semibold uppercase tracking-widest"
              style={{ color: ws.accent }}
            >
              {ws.name}
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {ws.nav.groups.filter(groupVisible).map((g) => (
          <NavGroup key={g.label} label={g.label} items={g.items} />
        ))}
        {ws.nav.extraItems?.filter(itemVisible).map((it) => (
          <SidebarGroup key={it.url}>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive(it.url)}>
                    <Link to={it.url}>
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="truncate text-xs text-sidebar-foreground/70">{user?.email}</div>
        <div
          className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: ws.accentLight, color: ws.accent }}
        >
          {ws.badge}
        </div>
        <Button onClick={signOut} variant="ghost" size="sm" className="mt-2 justify-start text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="mr-2 h-4 w-4" />Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
