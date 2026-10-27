import { Settings as SettingsIcon } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";
import { RimoraShell } from "@/components/RimoraShell";
import { ConnectorSettings } from "@/components/ConnectorSettings";
import { useAuth } from "@/contexts/AuthContext";

const Settings = () => {
  const { user } = useAuth();
  return (
  <RimoraShell>
    <div className="page-container max-w-4xl space-y-8">
      <header className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Workspace preferences
          </p>
          <h1 className="font-display text-4xl font-semibold">Settings</h1>
        </div>
      </header>
      {user && <ConnectorSettings />}
      <ComingSoon
        title="More settings are coming soon"
        description="Profile, appearance, account, and workspace preferences will be available here in a future update."
      />
    </div>
  </RimoraShell>
  );
};

export default Settings;
