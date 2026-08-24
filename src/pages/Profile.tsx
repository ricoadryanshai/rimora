import { useEffect, useState } from "react";
import { CalendarDays, CircleUserRound, MapPin, Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RimoraShell } from "@/components/RimoraShell";
import { supabase } from "@/integrations/supabase/client";

const Profile = () => {
  const { userId } = useParams();
  const [profile, setProfile] = useState<{ user_id: string; username: string | null; full_name: string | null; created_at: string; gender: string | null; location: string | null; bio: string | null; avatar_url: string | null; banner_url: string | null } | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active || error) return;

      const sessionUser = data.session?.user;
      setEmail(sessionUser?.email ?? "");
      if (sessionUser?.id === userId) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id,username,full_name,gender,location,bio,avatar_url,banner_url,created_at")
          .eq("id", userId)
          .maybeSingle();
        if (!active) return;
        setProfile({
          user_id: profileData?.user_id ?? "",
          username: profileData?.username ?? null,
          full_name: profileData?.full_name ?? sessionUser.user_metadata?.full_name ?? null,
          created_at: profileData?.created_at ?? sessionUser.created_at,
          gender: profileData?.gender ?? sessionUser.user_metadata?.leading_gender ?? null,
          location: profileData?.location ?? null,
          bio: profileData?.bio ?? null,
          avatar_url: profileData?.avatar_url ?? sessionUser.user_metadata?.avatar_url ?? null,
          banner_url: profileData?.banner_url ?? sessionUser.user_metadata?.banner_url ?? null,
        });
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [userId]);

  const name = profile?.username || profile?.full_name || email.split("@")[0] || "Reader";
  const gender = profile?.gender?.toLowerCase();
  const joinDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Unknown";

  return (
    <RimoraShell>
      <div className="page-container max-w-4xl space-y-8">
        <Card className="overflow-hidden">
          <div className="h-40 overflow-hidden bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/40">{profile?.banner_url && <img src={profile.banner_url} alt="Profile banner" className="h-full w-full object-cover" />}</div>
          <CardContent className="relative p-6 pt-0">
            <div className="-mt-12 flex items-end justify-between gap-4">
              <ProfileAvatar name={name} avatarUrl={profile?.avatar_url} className="h-24 w-24 border-4 border-card shadow-md transition-transform duration-200 hover:-translate-y-1 hover:scale-105" fallbackClassName="text-2xl" />
              <Button type="button" variant="outline" className="cursor-pointer" asChild><Link to={`/profile/${userId}/edit`}><Pencil /> Edit Profile</Link></Button>
            </div>
            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl font-semibold">{name}</h1>
                {gender === "male" && <CircleUserRound className="h-6 w-6 text-blue-600" aria-label="Male" />}
                {gender === "female" && <CircleUserRound className="h-6 w-6 text-pink-600" aria-label="Female" />}
              </div>
              <p className="font-mono text-xs text-muted-foreground">User ID: {profile?.user_id || "Loading"}</p>
              {profile?.bio?.trim() && <p className="max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{profile.bio}</p>}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Joined {joinDate}</p>
                {profile?.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {profile.location}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RimoraShell>
  );
};

export default Profile;
