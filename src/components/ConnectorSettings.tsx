import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Plug, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SUPABASE_URL, supabase } from "@/integrations/supabase/client";

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const sha256Hex = async (value: string) =>
  bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));

const generateToken = () => `rim_${bytesToHex(crypto.getRandomValues(new Uint8Array(24)))}`;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Never";

const CopyButton = ({ value, label }: { value: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        });
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
};

export const ConnectorSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("Claude");
  const [newToken, setNewToken] = useState<string | null>(null);
  const queryKey = ["mcp-tokens", user?.id];

  const { data: tokens = [], isPending } = useQuery({
    queryKey,
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mcp_tokens")
        .select("id,name,token_prefix,created_at,last_used_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const token = generateToken();
      const { error } = await supabase.from("mcp_tokens").insert({
        user_id: user!.id,
        name: name.trim(),
        token_hash: await sha256Hex(token),
        token_prefix: token.slice(0, 10),
      });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      setNewToken(token);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () =>
      toast({ title: "Could not create token", description: "Please try again.", variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mcp_tokens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: () =>
      toast({ title: "Could not revoke token", description: "Please try again.", variant: "destructive" }),
  });

  const endpoint = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/mcp` : "";
  const connectorUrl = newToken && endpoint ? `${endpoint}?token=${newToken}` : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <Plug className="h-5 w-5 text-primary" aria-hidden="true" />
          Claude connector
        </CardTitle>
        <CardDescription>
          Let Claude read and edit your novels, chapters and glossary. In Claude, go to Settings →
          Connectors → Add custom connector and paste the connector URL below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {newToken && (
          <div role="status" className="space-y-3 rounded-sm border border-accent/60 bg-accent/10 p-4">
            <p className="text-sm font-medium">
              Copy your connector URL now. It contains your secret token and won't be shown again.
            </p>
            <code className="block break-all rounded-sm bg-background/70 p-3 text-xs">
              {connectorUrl || "VITE_SUPABASE_URL is not configured."}
            </code>
            <div className="flex flex-wrap gap-2">
              {connectorUrl && <CopyButton value={connectorUrl} label="Copy connector URL" />}
              <CopyButton value={newToken} label="Copy token only" />
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewToken(null)}>
                Done
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this URL can change your content. Revoke it below if it leaks.
            </p>
          </div>
        )}

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <label htmlFor="mcp-token-name" className="sr-only">
            Token name
          </label>
          <Input
            id="mcp-token-name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Token name, e.g. Claude"
          />
          <Button type="submit" disabled={create.isPending || !name.trim()}>
            <KeyRound />
            {create.isPending ? "Creating..." : "Create token"}
          </Button>
        </form>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Active tokens</h3>
          {isPending ? (
            <p role="status" className="text-sm text-muted-foreground">Loading tokens...</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tokens yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-sm border">
              {tokens.map((token) => (
                <li key={token.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{token.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <code>{token.token_prefix}…</code> · Created {formatDate(token.created_at)} · Last used{" "}
                      {formatDate(token.last_used_at)}
                    </p>
                  </div>
                  <ConfirmationDialog
                    trigger={
                      <Button type="button" variant="ghost" size="icon" aria-label={`Revoke ${token.name}`}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                    title="Revoke token?"
                    description="Claude will immediately lose access with this token."
                    confirmLabel="Revoke"
                    destructive
                    onConfirm={() => revoke.mutate(token.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
