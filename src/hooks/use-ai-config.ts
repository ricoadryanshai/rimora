import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AiProvider {
  id: string;
  display_name: string;
  api_url: string;
  api_key_encrypted: string | null;
}

export interface AiGroup {
  id: string;
  name: string;
}

export interface AiModel {
  id: string;
  provider_id: string;
  group_id: string | null;
  model_id: string;
  display_name: string;
  provider_name?: string;
}

export interface AiSettings {
  active_model_id: string | null;
  target_language: string;
}

export const useAiConfig = () => {
  const { user } = useAuth();
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [groups, setGroups] = useState<AiGroup[]>([]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [settings, setSettings] = useState<AiSettings>({
    active_model_id: null,
    target_language: "English",
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setProviders([]);
      setGroups([]);
      setModels([]);
      setSettings({ active_model_id: null, target_language: "English" });
      return;
    }
    setLoading(true);
    const [p, g, m, s] = await Promise.all([
      supabase
        .from("ai_providers")
        .select("id, display_name, api_url, api_key_encrypted")
        .order("created_at"),
      supabase
        .from("ai_provider_groups")
        .select("id, name")
        .order("created_at"),
      supabase
        .from("ai_models")
        .select("id, provider_id, group_id, model_id, display_name")
        .order("created_at"),
      supabase
        .from("ai_settings")
        .select("active_model_id, target_language")
        .maybeSingle(),
    ]);
    setProviders(p.data ?? []);
    setGroups(g.data ?? []);
    setModels(
      (m.data ?? []).map((model) => ({
        ...model,
        provider_name: p.data?.find(
          (provider) => provider.id === model.provider_id,
        )?.display_name,
      })),
    );
    if (s.data) setSettings(s.data as AiSettings);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveSettings = useCallback(
    async (next: Partial<AiSettings>) => {
      if (!user) return;
      const merged = { ...settings, ...next };
      setSettings(merged);
      await supabase
        .from("ai_settings")
        .upsert({ user_id: user.id, ...merged }, { onConflict: "user_id" });
    },
    [settings, user],
  );

  const activeModel =
    models.find((m) => m.id === settings.active_model_id) ?? null;

  return {
    providers,
    groups,
    models,
    settings,
    activeModel,
    loading,
    refresh,
    saveSettings,
  };
};
