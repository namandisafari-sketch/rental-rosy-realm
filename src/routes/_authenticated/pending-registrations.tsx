import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Eye, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { verifyRegistrationPayment } from "@/lib/verifyRegistrationPayment.functions";

export const Route = createFileRoute("/_authenticated/pending-registrations")({
  head: () => ({ meta: [{ title: "Pending Registrations — Habico Portal" }] }),
  component: PendingRegistrationsPage,
});

type PendingRegistration = {
  id: string;
  plan_id: string | null;
  transaction_id: string;
  amount: number;
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  admin_name: string;
  admin_email: string;
  admin_phone: string | null;
  status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
};

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    verified: "bg-green-100 text-green-800 border-green-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
  };
  return (
    <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border " + (styles[status] || styles.pending)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

function PendingRegistrationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const [tab, setTab] = useState<"pending" | "verified" | "rejected">("pending");
  const [verifyTid, setVerifyTid] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [detailReg, setDetailReg] = useState<PendingRegistration | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  if (!isStaff) {
    return <div className="flex h-96 items-center justify-center"><p className="text-muted-foreground">Access denied.</p></div>;
  }

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["pending-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pending_registrations" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingRegistration[];
    },
  });

  const pending = registrations.filter((r) => r.status === "pending");
  const verified = registrations.filter((r) => r.status === "verified");
  const rejected = registrations.filter((r) => r.status === "rejected");
  const currentTab = tab === "pending" ? pending : tab === "verified" ? verified : rejected;

  const verifyMutation = useMutation({
    mutationFn: async ({ id, tid }: { id: string; tid: string }) => {
      const result = await verifyRegistrationPayment({ data: { pendingId: id, transactionId: tid } });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });
      toast.success("Registration verified and company created!");
      setVerifyingId(null);
      setVerifyTid("");
    },
    onError: (err) => toast.error((err as any)?.message || "Verification failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("pending_registrations" as any).update({
        status: "rejected",
        rejection_reason: reason,
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });
      toast.success("Registration rejected");
      setRejectOpen(false);
      setRejectId(null);
      setRejectReason("");
    },
    onError: (err) => toast.error((err as any)?.message || "Failed to reject"),
  });

  const handleReject = () => {
    if (!rejectId || !rejectReason.trim()) return;
    rejectMutation.mutate({ id: rejectId, reason: rejectReason.trim() });
  };

  function openVerify(reg: PendingRegistration) {
    setVerifyingId(reg.id);
    setVerifyTid("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pending Registrations</h1>
          <p className="text-sm text-muted-foreground">Verify mobile money payments and activate new companies</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
            <p className="text-xs text-muted-foreground">
              UGX {pending.reduce((s, r) => s + Number(r.amount), 0).toLocaleString()} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verified.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejected.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="border-b">
        <div className="flex gap-4">
          {(["pending", "verified", "rejected"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={"px-4 py-2 text-sm font-medium border-b-2 transition-colors " + (tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)} ({t === "pending" ? pending.length : t === "verified" ? verified.length : rejected.length})
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : currentTab.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">No {tab} registrations.</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTab.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-medium">{reg.company_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">{reg.admin_name}</div>
                    <div className="text-xs text-muted-foreground">{reg.admin_email}</div>
                  </TableCell>
                  <TableCell>UGX {Number(reg.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{new Date(reg.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{statusBadge(reg.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setDetailReg(reg)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader><DialogTitle>Registration Details</DialogTitle></DialogHeader>
                          {detailReg && (
                            <div className="space-y-4 text-sm">
                              <div>
                                <div className="border-b pb-2 mb-3"><h3 className="text-sm font-semibold">Company Info</h3></div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div><Label>Company</Label><p className="font-medium">{detailReg.company_name}</p></div>
                                  <div><Label>Email</Label><p>{detailReg.company_email || "\u2014"}</p></div>
                                  <div><Label>Phone</Label><p>{detailReg.company_phone || "\u2014"}</p></div>
                                  <div><Label>Address</Label><p>{detailReg.company_address || "\u2014"}</p></div>
                                </div>
                              </div>
                              <div>
                                <div className="border-b pb-2 mb-3"><h3 className="text-sm font-semibold">Admin Account</h3></div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div><Label>Name</Label><p className="font-medium">{detailReg.admin_name}</p></div>
                                  <div><Label>Email</Label><p>{detailReg.admin_email}</p></div>
                                  <div><Label>Phone</Label><p>{detailReg.admin_phone || "\u2014"}</p></div>
                                </div>
                              </div>
                              <div>
                                <div className="border-b pb-2 mb-3"><h3 className="text-sm font-semibold">Payment</h3></div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div><Label>Transaction ID</Label><p className="font-mono text-xs">{detailReg.transaction_id}</p></div>
                                  <div><Label>Amount</Label><p className="font-semibold">UGX {Number(detailReg.amount).toLocaleString()}</p></div>
                                  <div><Label>Submitted</Label><p>{new Date(detailReg.created_at).toLocaleString()}</p></div>
                                </div>
                              </div>
                              {detailReg.rejection_reason && (
                                <div>
                                  <div className="border-b pb-2 mb-3"><h3 className="text-sm font-semibold text-red-600">Rejection Reason</h3></div>
                                  <p>{detailReg.rejection_reason}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      {reg.status === "pending" && (
                        <>
                          <Dialog open={verifyingId === reg.id} onOpenChange={(o) => { if (!o) setVerifyingId(null); }}>
                            <DialogTrigger asChild>
                              <Button variant="default" size="sm" onClick={() => openVerify(reg)}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Verify
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Verify Payment</DialogTitle></DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Registrant TID: <strong className="font-mono">{reg.transaction_id}</strong>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Enter the matching TID from your own mobile money confirmation message.
                                </p>
                                <div>
                                  <Label>Your Transaction ID (TID)</Label>
                                  <Input
                                    className="mt-1.5 font-mono"
                                    value={verifyTid}
                                    onChange={(e) => setVerifyTid(e.target.value)}
                                    placeholder="Enter TID from your phone"
                                    maxLength={20}
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setVerifyingId(null)}>Cancel</Button>
                                  <Button
                                    onClick={() => verifyMutation.mutate({ id: reg.id, tid: verifyTid })}
                                    disabled={!verifyTid || verifyMutation.isPending}
                                  >
                                    {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Verify & Complete Registration
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={rejectOpen && rejectId === reg.id} onOpenChange={(o) => { if (!o) { setRejectOpen(false); setRejectId(null); } }}>
                            <DialogTrigger asChild>
                              <Button variant="destructive" size="sm" onClick={() => { setRejectId(reg.id); setRejectReason(""); setRejectOpen(true); }}>
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Reject Registration</DialogTitle></DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="reject-reason">Reason for Rejection</Label>
                                  <Textarea
                                    id="reject-reason"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Explain why the payment could not be verified"
                                    className="mt-1"
                                    rows={3}
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectId(null); }}>Cancel</Button>
                                  <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || rejectMutation.isPending}>
                                    {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
