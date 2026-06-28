// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  ClipboardList,
  Plus,
  ArrowLeftRight,
  AlertTriangle,
  Search,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/equipment-rentals")({
  component: EquipmentRentalsPage,
});

const RENTAL_STATUSES = [
  "active",
  "returned",
  "overdue",
  "damaged",
  "lost",
] as const;

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  returned: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  damaged:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  lost: "bg-red-200 text-red-900 dark:bg-red-950/50 dark:text-red-300",
};

function EquipmentRentalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = user?.role === "staff" || user?.role === "admin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<any>(null);

  const [form, setForm] = useState({
    asset_id: "",
    employee_id: "",
    project_id: "",
    start_date: "",
    expected_return_date: "",
    daily_rate: 0,
    deposit_amount: 0,
    condition_before: "",
  });

  const [returnForm, setReturnForm] = useState({
    actual_return_date: new Date().toISOString().split("T")[0],
    condition_after: "",
    notes: "",
  });

  const [damageForm, setDamageForm] = useState({
    status: "damaged" as "damaged" | "lost",
    notes: "",
  });

  const today = new Date().toISOString().split("T")[0];

  const { data: rentals, isLoading } = useQuery({
    queryKey: ["equipment-rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_rentals")
        .select(
          "*, assets(name, category), employees(full_name), projects(name)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: availableAssets } = useQuery({
    queryKey: ["assets", "available"],
    queryFn: async () => {
      const { data: rentedAssetIds, error: rentedError } = await supabase
        .from("equipment_rentals")
        .select("asset_id")
        .in("status", ["active", "overdue"]);
      if (rentedError) throw rentedError;
      const rentedIds = rentedAssetIds?.map((r) => r.asset_id) ?? [];
      let query = supabase
        .from("assets")
        .select("id, name, category, daily_rate")
        .eq("status", "available")
        .order("name");
      if (rentedIds.length > 0) {
        query = query.not("id", "in", `(${rentedIds.join(",")})`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees", "dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects", "dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const activeRentals =
    rentals?.filter((r) => r.status === "active").length ?? 0;
  const overdueRentals =
    rentals?.filter((r) => r.status === "overdue").length ?? 0;
  const availableCount = availableAssets?.length ?? 0;

  const filteredRentals = (rentals ?? []).filter((r) => {
    const assetName = r.assets?.name?.toLowerCase() ?? "";
    const employeeName = r.employees?.full_name?.toLowerCase() ?? "";
    const projectName = r.projects?.name?.toLowerCase() ?? "";
    const q = search.toLowerCase();
    const matchesSearch =
      assetName.includes(q) ||
      employeeName.includes(q) ||
      projectName.includes(q) ||
      (r.rental_number ?? "").toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { data: countData } = await supabase
        .from("equipment_rentals")
        .select("id", { count: "exact" });
      const count = countData?.length ?? 0;
      const rentalNumber = `RENT-${String(count + 1).padStart(5, "0")}`;
      const { error } = await supabase.from("equipment_rentals").insert([
        {
          rental_number: rentalNumber,
          asset_id: values.asset_id,
          employee_id: values.employee_id,
          project_id: values.project_id || null,
          start_date: values.start_date,
          expected_return_date: values.expected_return_date,
          daily_rate: values.daily_rate,
          deposit_amount: values.deposit_amount || 0,
          condition_before: values.condition_before,
          status: "active",
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-rentals"] });
      queryClient.invalidateQueries({ queryKey: ["assets", "available"] });
      toast.success("Equipment rental created");
      setCreateOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const returnMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: typeof returnForm;
    }) => {
      const rental = rentals?.find((r) => r.id === id);
      if (!rental) throw new Error("Rental not found");
      const start = new Date(rental.start_date);
      const end = new Date(values.actual_return_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      const totalCharge = totalDays * (rental.daily_rate ?? 0);
      const { error } = await supabase
        .from("equipment_rentals")
        .update({
          actual_return_date: values.actual_return_date,
          condition_after: values.condition_after,
          total_days: totalDays,
          total_charge: totalCharge,
          status: "returned",
          notes: values.notes
            ? `${rental.notes ?? ""}\nReturn notes: ${values.notes}`
            : rental.notes,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-rentals"] });
      queryClient.invalidateQueries({ queryKey: ["assets", "available"] });
      toast.success("Rental marked as returned");
      setReturnOpen(false);
      setSelectedRental(null);
      setReturnForm({
        actual_return_date: today,
        condition_after: "",
        notes: "",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const damageMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: typeof damageForm;
    }) => {
      const rental = rentals?.find((r) => r.id === id);
      const existingNotes = rental?.notes ?? "";
      const updatedNotes = existingNotes
        ? `${existingNotes}\n${values.status === "damaged" ? "Damaged" : "Lost"} notes: ${values.notes}`
        : `${values.status === "damaged" ? "Damaged" : "Lost"} notes: ${values.notes}`;
      const { error } = await supabase
        .from("equipment_rentals")
        .update({
          status: values.status,
          notes: updatedNotes,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-rentals"] });
      queryClient.invalidateQueries({ queryKey: ["assets", "available"] });
      toast.success(
        `Rental marked as ${damageForm.status === "damaged" ? "damaged" : "lost"}`
      );
      setDamageOpen(false);
      setSelectedRental(null);
      setDamageForm({ status: "damaged", notes: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function resetForm() {
    setForm({
      asset_id: "",
      employee_id: "",
      project_id: "",
      start_date: "",
      expected_return_date: "",
      daily_rate: 0,
      deposit_amount: 0,
      condition_before: "",
    });
  }

  function openReturn(rental: any) {
    setSelectedRental(rental);
    setReturnForm({
      actual_return_date: today,
      condition_after: "",
      notes: "",
    });
    setReturnOpen(true);
  }

  function openDamage(rental: any) {
    setSelectedRental(rental);
    setDamageForm({ status: "damaged", notes: "" });
    setDamageOpen(true);
  }

  function formatUGX(amount: number) {
    return `UGX ${(amount ?? 0).toLocaleString()}`;
  }

  function calcDaysOut(startDate: string, endDate?: string) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  }

  if (!isStaff) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Equipment Rentals
          </h1>
          <p className="text-muted-foreground">
            Track equipment checkouts and returns
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Rental
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Equipment Rental</DialogTitle>
              <DialogDescription>
                Check out equipment to an employee
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Equipment</h3></div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="asset_id">Asset *</Label>
                    <Select
                      value={form.asset_id}
                      onValueChange={(v) => {
                        const asset = availableAssets?.find((a) => a.id === v);
                        setForm({
                          ...form,
                          asset_id: v,
                          daily_rate: asset?.daily_rate ?? 0,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAssets?.length === 0 && (
                          <SelectItem value="__none__" disabled>
                            No available equipment
                          </SelectItem>
                        )}
                        {availableAssets?.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} ({a.category}) - {formatUGX(a.daily_rate ?? 0)}/day
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="condition_before">Condition Before</Label>
                    <Input
                      id="condition_before"
                      value={form.condition_before}
                      onChange={(e) => setForm({ ...form, condition_before: e.target.value })}
                      placeholder="e.g. Good, fair, excellent"
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Rental Period</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expected_return_date">Expected Return Date *</Label>
                    <Input
                      id="expected_return_date"
                      type="date"
                      value={form.expected_return_date}
                      onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-2">
                    <Label htmlFor="daily_rate">Daily Rate (UGX) *</Label>
                    <Input
                      id="daily_rate"
                      type="number"
                      min={0}
                      value={form.daily_rate}
                      onChange={(e) => setForm({ ...form, daily_rate: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deposit_amount">Deposit Amount (UGX)</Label>
                    <Input
                      id="deposit_amount"
                      type="number"
                      min={0}
                      value={form.deposit_amount}
                      onChange={(e) => setForm({ ...form, deposit_amount: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Vendor & Contact</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee_id">Employee *</Label>
                    <Select
                      value={form.employee_id}
                      onValueChange={(v) => setForm({ ...form, employee_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees?.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_id">Project</Label>
                    <Select
                      value={form.project_id}
                      onValueChange={(v) => setForm({ ...form, project_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!form.asset_id) {
                    toast.error("Asset is required");
                    return;
                  }
                  if (!form.employee_id) {
                    toast.error("Employee is required");
                    return;
                  }
                  if (!form.start_date) {
                    toast.error("Start date is required");
                    return;
                  }
                  if (!form.expected_return_date) {
                    toast.error("Expected return date is required");
                    return;
                  }
                  if (!form.daily_rate || form.daily_rate <= 0) {
                    toast.error("Daily rate must be greater than 0");
                    return;
                  }
                  createMutation.mutate(form);
                }}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Rental"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Rentals
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeRentals}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overdue
            </CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {overdueRentals}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Available Equipment
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by rental#, equipment, employee, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {RENTAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rental #</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Expected Return</TableHead>
                <TableHead>Days Out</TableHead>
                <TableHead>Total Charge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredRentals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    No rentals found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRentals.map((rental) => {
                  const daysOut = calcDaysOut(
                    rental.start_date,
                    rental.actual_return_date ?? undefined
                  );
                  const charge =
                    rental.total_charge ??
                    daysOut * (rental.daily_rate ?? 0);
                  return (
                    <TableRow key={rental.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-medium">
                          {rental.rental_number}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {rental.assets?.name}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {rental.assets?.category}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{rental.employees?.full_name}</TableCell>
                      <TableCell>
                        {rental.projects?.name ?? "-"}
                      </TableCell>
                      <TableCell>
                        {rental.start_date
                          ? new Date(rental.start_date).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {rental.expected_return_date
                          ? new Date(
                              rental.expected_return_date
                            ).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>{daysOut} days</TableCell>
                      <TableCell>{formatUGX(charge)}</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "font-medium",
                            STATUS_STYLES[rental.status ?? "active"]
                          )}
                          variant="secondary"
                        >
                          {rental.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(rental.status === "active" ||
                            rental.status === "overdue") && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openReturn(rental)}
                                title="Return"
                              >
                                <ArrowLeftRight className="h-4 w-4 mr-1" />
                                Return
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDamage(rental)}
                                title="Mark Damaged/Lost"
                              >
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Damage
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={returnOpen}
        onOpenChange={(open) => {
          setReturnOpen(open);
          if (!open) {
            setSelectedRental(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Equipment</DialogTitle>
            <DialogDescription>
              {selectedRental && (
                <span>
                  Returning: <strong>{selectedRental.assets?.name}</strong>{" "}
                  (Rental: {selectedRental.rental_number})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="actual_return_date">Actual Return Date</Label>
              <Input
                id="actual_return_date"
                type="date"
                value={returnForm.actual_return_date}
                onChange={(e) =>
                  setReturnForm({
                    ...returnForm,
                    actual_return_date: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="condition_after">Condition After</Label>
              <Input
                id="condition_after"
                value={returnForm.condition_after}
                onChange={(e) =>
                  setReturnForm({
                    ...returnForm,
                    condition_after: e.target.value,
                  })
                }
                placeholder="e.g. Good, fair, damaged"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-notes">Notes</Label>
              <Input
                id="return-notes"
                value={returnForm.notes}
                onChange={(e) =>
                  setReturnForm({ ...returnForm, notes: e.target.value })
                }
                placeholder="Any return notes"
              />
            </div>
            {selectedRental && returnForm.actual_return_date && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p>
                  Start Date:{" "}
                  {new Date(
                    selectedRental.start_date
                  ).toLocaleDateString()}
                </p>
                <p>
                  Return Date:{" "}
                  {new Date(
                    returnForm.actual_return_date
                  ).toLocaleDateString()}
                </p>
                <p>
                  Daily Rate: {formatUGX(selectedRental.daily_rate ?? 0)}
                </p>
                {(() => {
                  const start = new Date(selectedRental.start_date);
                  const end = new Date(returnForm.actual_return_date);
                  const diffTime = Math.abs(
                    end.getTime() - start.getTime()
                  );
                  const totalDays =
                    Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
                  const totalCharge =
                    totalDays * (selectedRental.daily_rate ?? 0);
                  return (
                    <>
                      <p>
                        Total Days: <strong>{totalDays}</strong>
                      </p>
                      <p>
                        Total Charge:{" "}
                        <strong>{formatUGX(totalCharge)}</strong>
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReturnOpen(false);
                setSelectedRental(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!returnForm.actual_return_date) {
                  toast.error("Return date is required");
                  return;
                }
                returnMutation.mutate({
                  id: selectedRental.id,
                  values: returnForm,
                });
              }}
              disabled={returnMutation.isPending}
            >
              {returnMutation.isPending
                ? "Processing..."
                : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={damageOpen}
        onOpenChange={(open) => {
          setDamageOpen(open);
          if (!open) {
            setSelectedRental(null);
            setDamageForm({ status: "damaged", notes: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Equipment</DialogTitle>
            <DialogDescription>
              {selectedRental && (
                <span>
                  {selectedRental.assets?.name} (Rental:{" "}
                  {selectedRental.rental_number})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="damage-status">Status</Label>
              <Select
                value={damageForm.status}
                onValueChange={(v) =>
                  setDamageForm({
                    ...damageForm,
                    status: v as "damaged" | "lost",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="damage-notes">Notes *</Label>
              <Input
                id="damage-notes"
                value={damageForm.notes}
                onChange={(e) =>
                  setDamageForm({ ...damageForm, notes: e.target.value })
                }
                placeholder="Describe the damage or loss"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDamageOpen(false);
                setSelectedRental(null);
                setDamageForm({ status: "damaged", notes: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!damageForm.notes) {
                  toast.error("Notes are required");
                  return;
                }
                damageMutation.mutate({
                  id: selectedRental.id,
                  values: damageForm,
                });
              }}
              disabled={damageMutation.isPending}
            >
              {damageMutation.isPending
                ? "Updating..."
                : `Mark as ${damageForm.status === "damaged" ? "Damaged" : "Lost"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
