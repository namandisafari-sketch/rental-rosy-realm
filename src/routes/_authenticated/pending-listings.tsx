// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { EntityCardGrid } from "@/components/entity-card-grid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Eye, Loader2, Building2, MapPin, DollarSign, Ruler, Bed, Bath, Phone, Mail, User, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pending-listings")({
  head: () => ({ meta: [{ title: "Pending Listings — Habico Portal" }] }),
  component: PendingListingsPage,
});

type PendingListing = {
  id: string;
  name: string;
  property_type: string;
  location: string | null;
  city: string | null;
  address: string | null;
  description: string | null;
  price: number | null;
  size_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  created_at: string;
};

function PendingListingsPage() {
  const queryClient = useQueryClient();
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PendingListing | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["pending-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingListing[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (listing: PendingListing) => {
      const { error: propError } = await supabase.from("properties").insert({
        name: listing.name,
        property_type: listing.property_type,
        location: listing.location,
        city: listing.city,
        address: listing.address,
        description: listing.description,
        price: listing.price,
        size_sqm: listing.size_sqm,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        is_active: true,
      });
      if (propError) throw propError;
      const { error } = await supabase.from("pending_listings").update({ status: "approved", admin_notes: adminNotes || null }).eq("id", listing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-listings"] });
      toast.success("Listing approved and published as a property!");
      setSelected(null);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (listing: PendingListing) => {
      const { error } = await supabase.from("pending_listings").update({ status: "rejected", admin_notes: rejectReason || null }).eq("id", listing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-listings"] });
      toast.success("Listing rejected");
      setSelected(null);
      setRejectReason("");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  if (!isStaff) {
    return <div className="p-6 text-sm text-muted-foreground">You do not have permission to view this page.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="mb-6">
        <h1 className="display text-2xl font-bold">Pending Listings</h1>
        <p className="text-sm text-muted-foreground">Review and approve/reject property submissions from brokers and the public</p>
      </div>

      <EntityCardGrid
        data={listings}
        isLoading={isLoading}
        searchFields={["name", "location", "contact_name", "contact_phone", "property_type"]}
        filterField="status"
        filterOptions={[
          { label: "Pending", value: "pending" },
          { label: "Approved", value: "approved" },
          { label: "Rejected", value: "rejected" },
        ]}
        keyExtractor={(item) => item.id}
        titleField="name"
        subtitleField="property_type"
        statusField="status"
        metricFields={[
          { key: "price", label: "Price", format: "currency" },
          { key: "location", label: "Location" },
          { key: "contact_name", label: "Submitted By" },
        ]}
        emptyMessage="No listings found"
        cardActions={(item) => (
          <>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setSelected(item); setAdminNotes(item.admin_notes ?? ""); }}>
              <Eye className="mr-1 h-3 w-3" /> View
            </Button>
            {item.status === "pending" && (
              <>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => approveMutation.mutate(item)}>
                  <CheckCircle className="mr-1 h-3 w-3" /> Approve
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => { setSelected(item); }}>
                  <XCircle className="mr-1 h-3 w-3" /> Reject
                </Button>
              </>
            )}
          </>
        )}
      />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Listing Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /><strong>{selected.name}</strong></div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Type:</span> {selected.property_type}</div>
                {selected.price && <div><span className="text-muted-foreground">Price:</span> UGX {selected.price.toLocaleString()}</div>}
                {selected.size_sqm && <div><Ruler className="mr-1 inline h-3 w-3" />{selected.size_sqm} sqm</div>}
                {selected.bedrooms && <div><Bed className="mr-1 inline h-3 w-3" />{selected.bedrooms}</div>}
                {selected.bathrooms && <div><Bath className="mr-1 inline h-3 w-3" />{selected.bathrooms}</div>}
              </div>
              {selected.location && <div><MapPin className="mr-1 inline h-3 w-3 text-muted-foreground" />{selected.location}{selected.city ? `, ${selected.city}` : ""}</div>}
              {selected.address && <div><MapPin className="mr-1 inline h-3 w-3 text-muted-foreground" />{selected.address}</div>}
              {selected.description && <div><p className="rounded bg-muted p-2 text-xs">{selected.description}</p></div>}
              <div className="rounded border p-3">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Submitted by</p>
                <div className="flex items-center gap-1 text-sm"><User className="h-3 w-3" /> {selected.contact_name}</div>
                <div className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" /> {selected.contact_phone}</div>
                {selected.contact_email && <div className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3" /> {selected.contact_email}</div>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Admin Notes</label>
                <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} placeholder="Optional notes about this listing..." />
              </div>
              <DialogFooter className="flex gap-2">
                <Button variant="destructive" onClick={() => { setRejectReason(adminNotes); rejectMutation.mutate(selected); }}>
                  <XCircle className="mr-1 h-4 w-4" /> Reject
                </Button>
                <Button onClick={() => approveMutation.mutate(selected)}>
                  <CheckCircle className="mr-1 h-4 w-4" /> Approve &amp; Publish
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
