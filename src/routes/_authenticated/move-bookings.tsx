import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/move-bookings")({
  head: () => ({ meta: [{ title: "Move Bookings — Habico Portal" }] }),
  component: MoveBookingsPage,
});

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function MoveBookingsPage() {
  const qc = useQueryClient();
  const { data: companyId, isLoading: companyLoading } = useCompanyId();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["move-bookings", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data }: any = await supabase
        .from("move_bookings" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error }: any = await supabase.from("move_bookings" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["move-bookings", companyId] });
      toast.success("Booking status updated");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  if (companyLoading) {
    return <div className="flex h-96 items-center justify-center"><p className="text-muted-foreground">Loading company...</p></div>;
  }
  if (!companyId) {
    return <div className="flex h-96 items-center justify-center"><p className="text-muted-foreground">No company configured. Contact your administrator.</p></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Services</div>
          <h1 className="display text-3xl font-bold">Move Bookings</h1>
          <p className="text-sm text-muted-foreground">Manage customer move-in and move-out booking requests</p>
        </div>
        <CalendarCheck className="h-8 w-8 text-muted-foreground" />
      </div>

      {isLoading ? (
        <Card><CardContent className="flex h-48 items-center justify-center"><p className="text-muted-foreground">Loading bookings...</p></CardContent></Card>
      ) : !bookings?.length ? (
        <Card>
          <CardHeader><CardTitle className="display">No Bookings Yet</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Customers haven't made any move service bookings yet.</p></CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="display">{bookings.length} Booking{bookings.length !== 1 ? "s" : ""}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.customer_name}</TableCell>
                    <TableCell className="font-mono text-xs">{b.customer_phone}</TableCell>
                    <TableCell><Badge variant="outline">{b.service_type === "move_in" ? "Move In" : b.service_type === "move_out" ? "Move Out" : "Both"}</Badge></TableCell>
                    <TableCell>{new Date(b.preferred_date).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{b.pickup_address} → {b.dropoff_address}</TableCell>
                    <TableCell className="font-mono text-xs">UGX {Number(b.total_price).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[b.status] || ""}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {b.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: b.id, status: "confirmed" })}>Confirm</Button>
                            <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ id: b.id, status: "cancelled" })}>Cancel</Button>
                          </>
                        )}
                        {b.status === "confirmed" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: b.id, status: "in_progress" })}>Start</Button>
                        )}
                        {b.status === "in_progress" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: b.id, status: "completed" })}>Complete</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
