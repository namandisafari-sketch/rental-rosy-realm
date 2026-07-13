import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, Mail, MailOpen, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Habico Portal" }] }),
  component: NotificationsPage,
});

function useNotifications(tenantId: string) {
  return useQuery({
    queryKey: ["notifications", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("rental_messages")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: !!tenantId,
  });
}

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: messages, isLoading } = useNotifications(user?.id ?? "");

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rental_messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (err: any) => toast.error(err.message),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("rental_messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("tenant_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All marked as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading notifications\u2026</div>;
  }

  const unread = (messages as any[])?.filter((m: any) => !m.is_read) ?? [];
  const read = (messages as any[])?.filter((m: any) => m.is_read) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Tenant Portal</p>
          <h1 className="display text-3xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unread.length > 0
              ? `You have ${unread.length} unread notification${unread.length === 1 ? "" : "s"}`
              : "No new notifications"}
          </p>
        </div>
        {unread.length > 0 && (
          <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck className="mr-2 h-4 w-4" />Mark all read
          </Button>
        )}
      </div>

      {unread.length > 0 && (
        <Card className="shadow-card border-l-4 border-l-accent">
          <CardHeader>
            <CardTitle className="display flex items-center gap-2">
              <Bell className="h-5 w-5 text-accent" />
              Unread
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unread.map((msg: any) => (
              <div key={msg.id} className="flex items-start justify-between rounded-lg border border-border p-3">
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 h-4 w-4 text-accent" />
                  <div>
                    <p className="font-medium text-sm">{msg.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{msg.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(msg.created_at).toLocaleDateString()} &middot; From: {msg.sender}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => markRead.mutate(msg.id)}>
                  <MailOpen className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {read.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="display flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-5 w-5" />
              Previously Read
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {read.slice(0, 20).map((msg: any) => (
              <div key={msg.id} className="flex items-start gap-3 rounded-lg border border-border/50 p-3 opacity-60">
                <MailOpen className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{msg.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{msg.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(msg.created_at).toLocaleDateString()} &middot; From: {msg.sender}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(!messages || messages.length === 0) && (
        <Card className="shadow-card">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            No notifications yet. When property managers send you messages, they will appear here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
