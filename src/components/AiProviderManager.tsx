import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { AiProvider, AiGroup, AiModel, AiSettings } from '@/hooks/use-ai-config';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: AiProvider[];
  groups: AiGroup[];
  models: AiModel[];
  settings: AiSettings;
  refresh: () => Promise<void> | void;
  saveSettings: (next: Partial<AiSettings>) => Promise<void> | void;
}

const NONE = '__none__';

const AiProviderManager = ({ open, onOpenChange, providers, groups, models, settings, refresh, saveSettings }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const [pName, setPName] = useState('');
  const [pUrl, setPUrl] = useState('https://api.openai.com/v1');
  const [pKey, setPKey] = useState('');

  const [gName, setGName] = useState('');

  const [mProvider, setMProvider] = useState('');
  const [mGroup, setMGroup] = useState(NONE);
  const [mModelId, setMModelId] = useState('');
  const [mName, setMName] = useState('');

  const [keyForProvider, setKeyForProvider] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');

  const storeKey = async (providerId: string, apiKey: string) => {
    const { error } = await supabase.functions.invoke('ai-provider-keys', {
      body: { providerId, apiKey },
    });
    if (error) throw new Error(error.message);
  };

  const addProvider = async () => {
    if (!user) return;
    if (!pName.trim() || !pUrl.trim() || !pKey.trim()) {
      toast({ title: 'Missing fields', description: 'Name, API URL and API key are required.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('ai_providers')
        .insert({ user_id: user.id, display_name: pName.trim(), api_url: pUrl.trim() })
        .select('id')
        .single();
      if (error) throw error;
      await storeKey(data.id, pKey.trim());
      setPName(''); setPKey('');
      await refresh();
      toast({ title: 'Provider added', description: 'Your API key is stored encrypted.' });
    } catch (e) {
      toast({ title: 'Could not add provider', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const updateKey = async (providerId: string) => {
    if (!newKey.trim()) return;
    setBusy(true);
    try {
      await storeKey(providerId, newKey.trim());
      setNewKey(''); setKeyForProvider(null);
      await refresh();
      toast({ title: 'API key updated' });
    } catch (e) {
      toast({ title: 'Could not update key', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const deleteRow = async (table: 'ai_providers' | 'ai_provider_groups' | 'ai_models', id: string) => {
    await supabase.from(table).delete().eq('id', id);
    await refresh();
  };

  const addGroup = async () => {
    if (!user || !gName.trim()) return;
    await supabase.from('ai_provider_groups').insert({ user_id: user.id, name: gName.trim() });
    setGName('');
    await refresh();
  };

  const addModel = async () => {
    if (!user) return;
    if (!mProvider || !mModelId.trim() || !mName.trim()) {
      toast({ title: 'Missing fields', description: 'Provider, model ID and display name are required.', variant: 'destructive' });
      return;
    }
    await supabase.from('ai_models').insert({
      user_id: user.id,
      provider_id: mProvider,
      group_id: mGroup === NONE ? null : mGroup,
      model_id: mModelId.trim(),
      display_name: mName.trim(),
    });
    setMModelId(''); setMName('');
    await refresh();
    toast({ title: 'Model added' });
  };

  const providerName = (id: string) => providers.find((p) => p.id === id)?.display_name ?? 'Unknown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Providers</DialogTitle>
          <DialogDescription>
            Configure your own OpenAI-compatible endpoints, organize them into groups, and pick the model used for translation.
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <p className="text-sm text-muted-foreground">Sign in to configure AI providers.</p>
        ) : (
          <Tabs defaultValue="models">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="models">Models</TabsTrigger>
              <TabsTrigger value="providers">Providers</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>

            <TabsContent value="models" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Active model</Label>
                <Select
                  value={settings.active_model_id ?? NONE}
                  onValueChange={(v) => saveSettings({ active_model_id: v === NONE ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select a model" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.display_name} — {providerName(m.provider_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-language">Target language</Label>
                <Input
                  id="target-language"
                  value={settings.target_language}
                  onChange={(e) => saveSettings({ target_language: e.target.value })}
                  placeholder="English"
                />
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <Label>Add a model</Label>
                <Select value={mProvider} onValueChange={setMProvider}>
                  <SelectTrigger><SelectValue placeholder="Provider" /></SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={mGroup} onValueChange={setMGroup}>
                  <SelectTrigger><SelectValue placeholder="Group (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No group</SelectItem>
                    {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={mModelId} onChange={(e) => setMModelId(e.target.value)} placeholder="Model ID (gpt-5.5)" />
                <Input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Display name (GPT-5.5)" />
                <Button onClick={addModel} className="w-full"><Plus className="h-4 w-4 mr-2" />Add model</Button>
              </div>

              <div className="space-y-2">
                {models.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 w-full border border-border rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.model_id} · {providerName(m.provider_id)}
                        {m.group_id ? ` · ${groups.find((g) => g.id === m.group_id)?.name ?? ''}` : ''}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => deleteRow('ai_models', m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="providers" className="space-y-4 pt-4">
              <div className="space-y-2 border border-border rounded-lg p-3">
                <Label>Add a provider</Label>
                <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Display name (OpenAI)" />
                <Input value={pUrl} onChange={(e) => setPUrl(e.target.value)} placeholder="https://api.xxx.ai/v1" />
                <Input value={pKey} onChange={(e) => setPKey(e.target.value)} type="password" placeholder="API key (sk-xxx)" />
                <Button onClick={addProvider} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add provider
                </Button>
              </div>

              <div className="space-y-2">
                {providers.map((p) => (
                  <div key={p.id} className="w-full border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.display_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.api_url}</p>
                      </div>
                      <Badge variant={p.api_key_encrypted ? 'secondary' : 'destructive'} className="shrink-0">
                        {p.api_key_encrypted ? 'Key set' : 'No key'}
                      </Badge>
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setKeyForProvider(keyForProvider === p.id ? null : p.id)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => deleteRow('ai_providers', p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {keyForProvider === p.id && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} type="password" placeholder="New API key" />
                        <Button onClick={() => updateKey(p.id)} disabled={busy} className="shrink-0">Save key</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="groups" className="space-y-4 pt-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Group name (Fast models)" />
                <Button onClick={addGroup} className="shrink-0"><Plus className="h-4 w-4 mr-2" />Add group</Button>
              </div>
              <div className="space-y-2">
                {groups.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 w-full border border-border rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {models.filter((m) => m.group_id === g.id).length} model(s)
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => deleteRow('ai_provider_groups', g.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AiProviderManager;
