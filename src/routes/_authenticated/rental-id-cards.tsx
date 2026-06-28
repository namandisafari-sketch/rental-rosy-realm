import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CreditCard, Printer, Download, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rental-id-cards")({
  head: () => ({ meta: [{ title: "Rental ID Cards — Habico Portal" }] }),
  component: RentalIdCardsPage,
});

function generateCardNumber() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `ID-${code}`;
}

function RentalIdCardsPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [cardNumber, setCardNumber] = useState(generateCardNumber());
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [printCard, setPrintCard] = useState<any>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["rental_id_cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_id_cards")
        .select("*, units!inner(id, unit_number, properties!inner(id, name)), tenants!left(id, full_name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units-available-cards"],
    queryFn: async () => {
      const { data: activeCardUnitIds } = await supabase
        .from("rental_id_cards")
        .select("unit_id")
        .eq("status", "active");
      const occupiedIds = new Set((activeCardUnitIds ?? []).map((c: any) => c.unit_id));
      const { data } = await supabase
        .from("units")
        .select("id, unit_number, properties(name)")
        .order("unit_number");
      return ((data ?? []) as any).map((u: any) => ({
        ...u,
        hasActiveCard: occupiedIds.has(u.id),
      }));
    },
    enabled: isStaff,
  });

  const total = cards.length;
  const activeCount = cards.filter((c: any) => c.status === "active").length;
  const lostCount = cards.filter((c: any) => c.status === "lost").length;
  const returnedCount = cards.filter((c: any) => c.status === "returned").length;

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rental_id_cards").insert({
        unit_id: selectedUnit,
        card_number: cardNumber,
        status: "active",
        issued_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rental_id_cards"] });
      toast.success("ID card created");
      setCreateOpen(false);
      setSelectedUnit("");
      setCardNumber(generateCardNumber());
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const payload: any = { status };
      if (status === "lost") payload.lost_reason = reason ?? null;
      if (status === "active") payload.lost_reason = null;
      const { error } = await supabase.from("rental_id_cards").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rental_id_cards"] });
      toast.success("Card status updated");
      setLostDialogOpen(false);
      setLostReason("");
      setSelectedCard(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function handleCreate() {
    if (!selectedUnit) {
      toast.error("Please select a unit");
      return;
    }
    createMutation.mutate();
  }

  function openLostDialog(card: any) {
    setSelectedCard(card);
    setLostReason("");
    setLostDialogOpen(true);
  }

  function confirmLost() {
    if (!selectedCard || !lostReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    statusMutation.mutate({ id: selectedCard.id, status: "lost", reason: lostReason.trim() });
  }

  function getSelectedUnitData() {
    return units.find((u: any) => u.id === selectedUnit) as any;
  }

  function statusBadge(status: string) {
    const cls = {
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200 dark:border-green-800",
      lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-200 dark:border-red-800",
      returned: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700",
    }[status] ?? "bg-secondary text-secondary-foreground";
    return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });
  }

  function handlePrint(card: any) {
    setPrintCard(card);
    setTimeout(() => {
      window.print();
    }, 200);
  }

  function handleDownloadPng(card: any) {
    setPrintCard(card);
    setTimeout(() => {
      window.print();
    }, 200);
  }

  const selectedUnitData = getSelectedUnitData();

  if (!isStaff) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  const previewSection = selectedUnitData ? (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Card Preview</h4>
      <div className="mx-auto max-w-xs rounded-lg border-2 border-dashed border-accent p-4 text-center">
        <CreditCard className="mx-auto mb-2 h-8 w-8 text-accent" />
        <p className="text-sm font-bold">{selectedUnitData.properties?.name || "Property"}</p>
        <p className="text-xs text-muted-foreground">Unit {selectedUnitData.unit_number}</p>
        <div className="my-3 border-t" />
        <p className="font-mono text-lg font-bold tracking-wider">{cardNumber}</p>
        <p className="mt-2 text-xs text-muted-foreground">Issued: {formatDate(new Date().toISOString())}</p>
      </div>
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Management</div>
          <h1 className="display text-3xl font-bold">Rental ID Cards</h1>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setSelectedUnit(""); setCardNumber(generateCardNumber()); } }}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" />Issue New Card
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Issue New ID Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div>
                <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Tenant &amp; Unit</h3></div>
                <div className="space-y-2">
                  <Label>Unit *</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger><SelectValue placeholder="Select unit…" /></SelectTrigger>
                    <SelectContent>
                      {units.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.properties?.name} · Unit {u.unit_number} {u.hasActiveCard ? "(has active card)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">Units with an active card already are shown for reference. Only one active card per unit is allowed.</p>
                </div>
              </div>
              <div>
                <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Card Details</h3></div>
                <div className="space-y-2">
                  <Label>Card Number</Label>
                  <div className="flex gap-2">
                    <Input value={cardNumber} readOnly className="font-mono" />
                    <Button variant="outline" onClick={() => setCardNumber(generateCardNumber())}>
                      Regenerate
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Auto-generated unique card identifier. Click Regenerate for a new number.</p>
                </div>
              </div>
              {previewSection}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); setSelectedUnit(""); setCardNumber(generateCardNumber()); }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!selectedUnit || createMutation.isPending}>
                {createMutation.isPending ? "Issuing…" : "Issue Card"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lost</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lostCount}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Returned</CardTitle>
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{returnedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card Number</TableHead>
                <TableHead>Property / Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">Loading...</TableCell>
                </TableRow>
              ) : cards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No ID cards found</TableCell>
                </TableRow>
              ) : (
                cards.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.card_number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.units?.properties?.name} · Unit {c.units?.unit_number}
                    </TableCell>
                    <TableCell>{c.tenants?.full_name || "—"}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.issued_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handlePrint(c)} title="Print card">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDownloadPng(c)} title="Download / Print">
                          <Download className="h-4 w-4" />
                        </Button>
                        {c.status === "active" && (
                          <Button variant="ghost" size="icon" onClick={() => openLostDialog(c)} title="Mark as lost" className="text-destructive hover:text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                        )}
                        {c.status === "active" && (
                          <Button variant="ghost" size="icon" onClick={() => statusMutation.mutate({ id: c.id, status: "returned" })} title="Mark as returned">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {(c.status === "lost" || c.status === "returned") && (
                          <Button variant="ghost" size="icon" onClick={() => statusMutation.mutate({ id: c.id, status: "active" })} title="Reactivate">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={lostDialogOpen} onOpenChange={(o) => { setLostDialogOpen(o); if (!o) { setSelectedCard(null); setLostReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Card as Lost</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Lost Card Report</h3></div>
              <AlertDialogDescription className="text-sm mb-4">
                {selectedCard && (
                  <span>
                    Marking card <strong>{selectedCard.card_number}</strong> as lost. This will deactivate it and record the reason.
                  </span>
                )}
              </AlertDialogDescription>
              <div className="space-y-2">
                <Label>Reason for Loss *</Label>
                <Input
                  value={lostReason}
                  onChange={(e: any) => setLostReason(e.target.value)}
                  placeholder="e.g. Tenant reported lost, stolen, misplaced, damaged…"
                />
                <p className="mt-1 text-xs text-muted-foreground">Provide details about how the card was lost for record-keeping.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLostDialogOpen(false); setSelectedCard(null); setLostReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmLost} disabled={!lostReason.trim() || statusMutation.isPending}>
              {statusMutation.isPending ? "Updating…" : "Mark as Lost"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printCard && (
        <div className="print-only" id="print-area">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #print-area, #print-area * { visibility: visible; }
              #print-area { position: absolute; left: 0; top: 0; width: 100%; }
            }
            .card-print { max-width: 350px; margin: 40px auto; padding: 24px; border: 2px solid #000; border-radius: 12px; text-align: center; font-family: monospace; }
            .card-print h2 { font-size: 18px; margin-bottom: 4px; }
            .card-print .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
            .card-print .divider { border-top: 1px solid #ccc; margin: 12px 0; }
            .card-print .number { font-size: 22px; letter-spacing: 3px; font-weight: bold; }
            .card-print .footer { font-size: 10px; color: #999; margin-top: 16px; }
          `}</style>
          <div className="card-print">
            <h2>{printCard.units?.properties?.name || "Property"}</h2>
            <p className="sub">Unit {printCard.units?.unit_number}</p>
            {printCard.tenants?.full_name && <p className="sub">{printCard.tenants.full_name}</p>}
            <div className="divider" />
            <p className="number">{printCard.card_number}</p>
            <p className="sub">Issued: {formatDate(printCard.issued_at)}</p>
            <div className="divider" />
            <p className="footer">Habico Portal · Rental ID Card</p>
          </div>
        </div>
      )}
    </div>
  );
}
