import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2, Home, Users, FileText, Receipt, Wrench, BarChart3,
  Settings, LogOut, Package, Toolbox, ShoppingCart, Briefcase,
  HardHat, DollarSign, ClipboardList, Truck, Repeat, ShieldCheck,
  MessageSquare, FileSignature, CreditCard, QrCode, CalendarCheck, Calculator,
  PhoneCall, FileBadge, FolderOpen, ListChecks, ClipboardPen,
  MessageSquareQuote, FileUp, Handshake, GitCompareArrows, Clock,
  PiggyBank, Landmark, FileCheck, ClipboardCheck, Hash,
  ReceiptText, ScrollText
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarFooter, SidebarHeader
} from "@/components/ui/sidebar";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { Button } from "./ui/button";

interface NavItem { title: string; url: string; icon: any }

const rentalItems: NavItem[] = [
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Leases", url: "/leases", icon: FileText },
  { title: "Tenants", url: "/tenants", icon: Users },
  { title: "Payments", url: "/payments", icon: Receipt },
  { title: "Recurring Billing", url: "/recurring-billing", icon: Repeat },
  { title: "Payment Proofs", url: "/payment-proofs", icon: ShieldCheck },
  { title: "Messages", url: "/rental-messages", icon: MessageSquare },
  { title: "E-Leasing", url: "/e-leasing", icon: FileSignature },
  { title: "ID Cards", url: "/rental-id-cards", icon: CreditCard },
  { title: "Listing Banners", url: "/listing-banners", icon: QrCode },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
  { title: "Preventative Maintenance", url: "/preventative-maintenance", icon: CalendarCheck },
  { title: "Tax Dashboard", url: "/rental-tax-dashboard", icon: Calculator },
];

const constructionItems: NavItem[] = [
  { title: "Projects", url: "/projects", icon: HardHat },
  { title: "Project Tasks", url: "/project-tasks", icon: ListChecks },
  { title: "Daily Logs", url: "/daily-logs", icon: ClipboardPen },
  { title: "RFIs", url: "/rfis", icon: MessageSquareQuote },
  { title: "Submittals", url: "/submittals", icon: FileUp },
  { title: "Leads", url: "/leads", icon: PhoneCall },
  { title: "Estimates", url: "/estimates", icon: Calculator },
  { title: "Proposals", url: "/proposals", icon: FileBadge },
  { title: "Bid Packages", url: "/bid-packages", icon: FolderOpen },
  { title: "Employees", url: "/employees", icon: Briefcase },
  { title: "Timesheets", url: "/timesheets", icon: Clock },
  { title: "Expenses", url: "/expenses", icon: DollarSign },
  { title: "Receipts", url: "/receipts", icon: ReceiptText },
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Assets", url: "/assets", icon: Toolbox },
  { title: "Equipment Rentals", url: "/equipment-rentals", icon: ClipboardList },
];

const constructionFinancialItems: NavItem[] = [
  { title: "Construction Invoices", url: "/construction-invoices", icon: FileText },
  { title: "Subcontracts", url: "/subcontracts", icon: Handshake },
  { title: "Change Orders", url: "/change-orders", icon: GitCompareArrows },
  { title: "Allowances", url: "/allowances", icon: PiggyBank },
  { title: "Project Budget", url: "/project-budget", icon: Landmark },
  { title: "Bills", url: "/bills", icon: ScrollText },
  { title: "Lien Waivers", url: "/lien-waivers", icon: FileCheck },
];

const sopItems: NavItem[] = [
  { title: "SOP Dashboard", url: "/sop", icon: ClipboardCheck },
  { title: "SOP Checklists", url: "/sop-checklists", icon: ListChecks },
  { title: "SOP Forms", url: "/sop-forms", icon: FileSignature },
  { title: "Cost Codes", url: "/cost-codes", icon: Hash },
];

const reportItems: NavItem[] = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Financial Reports", url: "/financial-reports", icon: DollarSign },
];

const ownerItems: NavItem[] = [
  { title: "Overview", url: "/dashboard", icon: Home },
  { title: "My properties", url: "/properties", icon: Building2 },
  { title: "Leases", url: "/leases", icon: FileText },
  { title: "Payments", url: "/payments", icon: Receipt },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const tenantItems: NavItem[] = [
  { title: "Overview", url: "/dashboard", icon: Home },
  { title: "My lease", url: "/leases", icon: FileText },
  { title: "My payments", url: "/payments", icon: Receipt },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
];

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => path === url || (url !== "/dashboard" && path.startsWith(url));
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
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
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const role = useHighestRole();
  const { user, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => path === url || (url !== "/dashboard" && path.startsWith(url));

  if (role === "tenant") {
    return (
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="display text-sm font-bold text-sidebar-foreground">HABICO</div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-accent">Portal</div>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <NavGroup label="Tenant" items={tenantItems} />
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/settings")}>
                    <Link to="/settings"><Settings className="h-4 w-4" /><span>Settings</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="truncate text-xs text-sidebar-foreground/70">{user?.email}</div>
          <Button onClick={signOut} variant="ghost" size="sm" className="mt-2 justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </SidebarFooter>
      </Sidebar>
    );
  }

  if (role === "owner") {
    return (
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="display text-sm font-bold text-sidebar-foreground">HABICO</div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-accent">Portal</div>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <NavGroup label="Owner" items={ownerItems} />
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/settings")}>
                    <Link to="/settings"><Settings className="h-4 w-4" /><span>Settings</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="truncate text-xs text-sidebar-foreground/70">{user?.email}</div>
          <Button onClick={signOut} variant="ghost" size="sm" className="mt-2 justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="display text-sm font-bold text-sidebar-foreground">HABICO</div>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-accent">Portal</div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")}>
                  <Link to="/dashboard"><Home className="h-4 w-4" /><span>Dashboard</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavGroup label="Rental Management" items={rentalItems} />
        <NavGroup label="Construction" items={constructionItems} />
        <NavGroup label="Construction Financial" items={constructionFinancialItems} />
        <NavGroup label="SOP & Quality" items={sopItems} />
        <NavGroup label="Reports" items={reportItems} />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/settings")}>
                  <Link to="/settings"><Settings className="h-4 w-4" /><span>Settings</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="truncate text-xs text-sidebar-foreground/70">{user?.email}</div>
        <Button onClick={signOut} variant="ghost" size="sm" className="mt-2 justify-start text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="mr-2 h-4 w-4" />Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
