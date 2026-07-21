import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Mail, MessageSquare, Loader2, MapPin, Home } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/land-inquiries")({
  head: () => ({ meta: [{ title: "Land Inquiries — Habico Portal" }] }),
  component: LandInquiriesPage,
});

type Inquiry = {
  id: string;
  property_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: "new" | "contacted" | "resolved" | "archived";
  created_at: string;
  properties?: { name: string; location: string | null } | null;
};

const statusStyles: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-300",
  contacted: "bg-amber-100 text-amber-800 border-amber-300",
  resolved: "bg-green-100 text-green-800 border-green-300",
  archived: "bg-gray-100 text-gray-500 border-gray-300",
};

function LandInquiriesPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [notes, setNotes] = useState("");

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["land-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("land_inquiries")
        .select("*, properties(name, location)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Inquiry[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("land_inquiries").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["land-inquiries"] });
      toast.success("Inquiry updated");
      setSelected(null);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="display text-2xl font-bold">Land Inquiries</h1>
        <p className="text-sm text-muted-foreground">Manage inquiries from the Land for Sale page</p>
      </div>

      <Card>
        <CardHeader><CardTitle>All Inquiries</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : inquiries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No inquiries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inq) => (
                  <TableRow key={inq.id}>
                    <TableCell className="text-xs">{new Date(inq.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{inq.name}</TableCell>
                    <TableCell className="text-sm">{inq.properties?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <a href={`tel:${inq.phone}`} className="text-xs text-accent hover:underline"><Phone className="inline h-3 w-3" /> {inq.phone}</a>
                        {inq.email && <a href={`mailto:${inq.email}`} className="text-xs text-accent hover:underline"><Mail className="inline h-3 w-3" /></a>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyles[inq.status]}>{inq.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSelected(inq)}><MessageSquare className="h-3 w-3" /></Button>
                        {inq.status === "new" && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: inq.id, status: "contacted" })}>Mark Contacted</Button>}
                        {inq.status === "contacted" && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: inq.id, status: "resolved" })}>Resolve</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inquiry Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><strong>Name:</strong> {selected.name}</div>
              <div><strong>Phone:</strong> <a href={`tel:${selected.phone}`} className="text-accent hover:underline">{selected.phone}</a></div>
              {selected.email && <div><strong>Email:</strong> <a href={`mailto:${selected.email}`} className="text-accent hover:underline">{selected.email}</a></div>}
              {selected.properties && <div><strong>Property:</strong> {selected.properties.name}{selected.properties.location ? ` — ${selected.properties.location}` : ""}</div>}
              {selected.message && <div><strong>Message:</strong><p className="mt-1 rounded bg-muted p-2">{selected.message}</p></div>}
              <div className="flex gap-2 pt-2">
                {selected.status === "new" && <Button size="sm" onClick={() => updateStatus.mutate({ id: selected.id, status: "contacted" })}>Mark Contacted</Button>}
                {selected.status === "contacted" && <Button size="sm" onClick={() => updateStatus.mutate({ id: selected.id, status: "resolved" })}>Mark Resolved</Button>}
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: selected.id, status: "archived" })}>Archive</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
