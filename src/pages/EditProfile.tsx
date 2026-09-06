import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Camera, Check, Link2, Pencil, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/LoadingButton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RimoraShell } from "@/components/RimoraShell";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const countries = [
  "Global",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "China",
  "Japan",
  "South Korea",
  "Indonesia",
  "India",
  "Germany",
  "France",
  "Brazil",
];

const EditProfile = () => {
  const { userId } = useParams();
  const { linkGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("Global");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [bannerZoom, setBannerZoom] = useState(1);
  const [bannerPosition, setBannerPosition] = useState({ x: 0, y: 0 });
  const [draggingBanner, setDraggingBanner] = useState(false);
  const bannerDragStart = useRef({ x: 0, y: 0 });
  const bannerPositionStart = useRef({ x: 0, y: 0 });
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarPosition, setAvatarPosition] = useState({ x: 0, y: 0 });
  const [draggingAvatar, setDraggingAvatar] = useState(false);
  const avatarDragStart = useRef({ x: 0, y: 0 });
  const avatarPositionStart = useRef({ x: 0, y: 0 });
  const [avatarInputRef] = useState(() => ({
    current: null as HTMLInputElement | null,
  }));
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const googleIdentity = user?.identities?.find(
    (identity) => identity.provider === "google",
  );
  const initials =
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "R";

  useEffect(() => {
    if (!user || user.id !== userId) return;
    setName(user.user_metadata?.full_name ?? "");
    setUsername(user.user_metadata?.username ?? "");
    setEmail(user.email ?? "");
    setGender(user.user_metadata?.leading_gender ?? "");
    setAvatarUrl(user.user_metadata?.avatar_url ?? "");
    setBannerUrl(user.user_metadata?.banner_url ?? "");
    void supabase
      .from("profiles")
      .select("username,full_name,gender,location,bio,avatar_url,banner_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setName(data.full_name ?? "");
        setUsername(data.username ?? "");
        setGender(data.gender ?? user.user_metadata?.leading_gender ?? "");
        setLocation(data.location ?? "Global");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? "");
        setBannerUrl(data.banner_url ?? "");
      });
  }, [user, userId]);

  useEffect(() => {
    const normalized = username.trim().toLowerCase();
    if (
      !normalized ||
      !user ||
      normalized === (user.user_metadata?.username ?? "").toLowerCase()
    ) {
      setUsernameAvailable(true);
      setUsernameError("");
      setCheckingUsername(false);
      return;
    }
    setCheckingUsername(true);
    const timeout = window.setTimeout(() => {
      void supabase
        .from("profiles")
        .select("id")
        .eq("username", normalized)
        .neq("id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          setCheckingUsername(false);
          if (error) {
            setUsernameAvailable(false);
            setUsernameError("Username availability could not be checked.");
            return;
          }
          setUsernameAvailable(!data);
          setUsernameError(data ? "This username is already taken." : "");
        });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [username, user]);

  const saveChanges = async () => {
    if (!user || user.id !== userId || checkingUsername || !usernameAvailable)
      return;
    setSaving(true);
    const profileResult = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        full_name: name.trim(),
        gender: gender || null,
        location,
        bio,
        avatar_url: avatarUrl || null,
        banner_url: bannerUrl || null,
      })
      .eq("id", user.id);
    const authResult = await supabase.auth.updateUser({
      email: email.trim(),
      data: {
        username: username.trim(),
        full_name: name.trim(),
        leading_gender: gender || null,
        avatar_url: avatarUrl || null,
        banner_url: bannerUrl || null,
      },
    });
    setSaving(false);
    if (profileResult.error?.code === "23505")
      setUsernameError("This username is already taken.");
    if (!profileResult.error && !authResult.error)
      navigate(`/profile/${user.id}`);
  };

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true);
    const { error } = await linkGoogle();
    if (error) {
      setLinkingGoogle(false);
      window.alert(error.message);
    }
  };

  const chooseAvatarFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarZoom(1);
    setAvatarPosition({ x: 0, y: 0 });
  };

  const startAvatarDrag = (event: PointerEvent<HTMLDivElement>) => {
    setDraggingAvatar(true);
    avatarDragStart.current = { x: event.clientX, y: event.clientY };
    avatarPositionStart.current = avatarPosition;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveAvatar = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingAvatar) return;
    setAvatarPosition({
      x:
        avatarPositionStart.current.x +
        event.clientX -
        avatarDragStart.current.x,
      y:
        avatarPositionStart.current.y +
        event.clientY -
        avatarDragStart.current.y,
    });
  };

  const chooseBannerFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setBannerZoom(1);
    setBannerPosition({ x: 0, y: 0 });
  };
  const startBannerDrag = (event: PointerEvent<HTMLDivElement>) => {
    setDraggingBanner(true);
    bannerDragStart.current = { x: event.clientX, y: event.clientY };
    bannerPositionStart.current = bannerPosition;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBanner = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingBanner) return;
    setBannerPosition({
      x:
        bannerPositionStart.current.x +
        event.clientX -
        bannerDragStart.current.x,
      y:
        bannerPositionStart.current.y +
        event.clientY -
        bannerDragStart.current.y,
    });
  };

  const saveAvatar = async () => {
    if (!user) return;
    if (savingAvatar) return;
    setSavingAvatar(true);
    try {
      const sourceUrl = avatarPreview || avatarUrl.trim();
      let nextUrl = avatarUrl.trim();
      if (sourceUrl) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = sourceUrl;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = reject;
        });
        const outputSize = 512;
        const canvas = document.createElement("canvas");
        canvas.width = outputSize;
        canvas.height = outputSize;
        const context = canvas.getContext("2d");
        if (!context) return;
        const scale =
          Math.max(
            outputSize / image.naturalWidth,
            outputSize / image.naturalHeight,
          ) * avatarZoom;
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(
          image,
          (outputSize - width) / 2 + avatarPosition.x * (outputSize / 224),
          (outputSize - height) / 2 + avatarPosition.y * (outputSize / 224),
          width,
          height,
        );
        const croppedBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.9),
        );
        if (!croppedBlob) return;
        const croppedFile = new File([croppedBlob], "avatar.jpg", {
          type: "image/jpeg",
        });
        const path = `${user.id}/avatar.jpg`;
        const upload = await supabase.storage
          .from("avatars")
          .upload(path, croppedFile, {
            upsert: true,
            contentType: "image/jpeg",
          });
        if (upload.error) return;
        nextUrl = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      }
      setAvatarUrl(nextUrl);
      setAvatarDialogOpen(false);
      setAvatarFile(null);
    } finally {
      setSavingAvatar(false);
    }
  };

  const saveBanner = async () => {
    if (!user) return;
    if (savingBanner) return;
    setSavingBanner(true);
    try {
      const sourceUrl = bannerPreview || bannerUrl.trim();
      if (!sourceUrl) {
        setBannerDialogOpen(false);
        return;
      }
      let cropSourceUrl = sourceUrl;
      if (
        !bannerPreview &&
        /^https?:\/\//i.test(sourceUrl) &&
        !sourceUrl.includes("supabase.co/storage")
      ) {
        const { data, error } = await supabase.functions.invoke("image-proxy", {
          body: { url: sourceUrl },
        });
        if (error || !data?.dataUrl) return;
        cropSourceUrl = data.dataUrl;
      }
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = cropSourceUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
      });
      const width = 1200;
      const height = 360;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      const scale =
        Math.max(width / image.naturalWidth, height / image.naturalHeight) *
        bannerZoom;
      const imageWidth = image.naturalWidth * scale;
      const imageHeight = image.naturalHeight * scale;
      context.drawImage(
        image,
        (width - imageWidth) / 2 + bannerPosition.x * (width / 462),
        (height - imageHeight) / 2 + bannerPosition.y * (height / 224),
        imageWidth,
        imageHeight,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) return;
      const path = `${user.id}/banner.jpg`;
      const upload = await supabase.storage
        .from("avatars")
        .upload(path, new File([blob], "banner.jpg", { type: "image/jpeg" }), {
          upsert: true,
          contentType: "image/jpeg",
        });
      if (upload.error) return;
      setBannerUrl(
        `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`,
      );
      setBannerDialogOpen(false);
      setBannerFile(null);
    } finally {
      setSavingBanner(false);
    }
  };

  return (
    <RimoraShell>
      <div className="page-container max-w-4xl space-y-8">
        <Card className="overflow-hidden">
          <div className="group relative block h-40 w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/40" />
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt="Profile banner"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <button
              type="button"
              onClick={() => setBannerDialogOpen(true)}
              className="absolute bottom-3 right-3 z-20 inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-card bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground opacity-90 shadow-md transition-all hover:-translate-y-0.5 hover:opacity-100"
              aria-label="Edit Banner"
            >
              <Camera className="h-4 w-4" /> Edit Banner
            </button>
          </div>
          <CardContent className="relative p-6 pt-0">
            <div className="-mt-12 flex items-end gap-4">
              <button
                type="button"
                onClick={() => setAvatarDialogOpen(true)}
                className="group relative cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {avatarPreview ? (
                  <ProfileAvatar
                    name={name}
                    avatarUrl={avatarPreview}
                    className="h-24 w-24 border-4 border-card shadow-md transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105"
                    fallbackClassName="text-2xl"
                  />
                ) : (
                  <ProfileAvatar
                    name={name}
                    avatarUrl={avatarUrl}
                    className="h-24 w-24 border-4 border-card shadow-md transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105"
                    fallbackClassName="text-2xl"
                  />
                )}
                <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground">
                  <Camera className="h-4 w-4" />
                </span>
              </button>
            </div>
            <div className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-username">Username</Label>
                <Input
                  id="profile-username"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, ""),
                    )
                  }
                  placeholder="Choose a username"
                  required
                  aria-invalid={!usernameAvailable || undefined}
                  className={
                    !usernameAvailable
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/40"
                      : undefined
                  }
                />
                {checkingUsername && (
                  <p className="text-xs text-muted-foreground">
                    Checking username availability...
                  </p>
                )}
                {usernameError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {usernameError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-muted/30 px-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">Google account</p>
                    <p className="text-xs text-muted-foreground">
                      {googleIdentity
                        ? `Linked: ${googleIdentity.identity_data?.email ?? "Google account"}`
                        : "Not linked to a Google account"}
                    </p>
                  </div>
                  {googleIdentity ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <Check className="h-4 w-4" /> Linked
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleLinkGoogle()}
                      disabled={linkingGoogle}
                    >
                      <Link2 />
                      {linkingGoogle ? "Linking..." : "Link Google"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-bio">About / Bio</Label>
                <Textarea
                  id="profile-bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={5}
                  placeholder="Tell readers a little about yourself"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => navigate(`/profile/${userId}`)}
                disabled={saving || checkingUsername || !usernameAvailable}
              >
                Cancel
              </Button>
              <LoadingButton
                type="button"
                className="cursor-pointer"
                onClick={() => void saveChanges()}
                loading={saving}
                loadingLabel="Saving..."
                disabled={checkingUsername || !usernameAvailable}
              >
                <Pencil /> {saving ? "Saving..." : "Save Changes"}
              </LoadingButton>
            </div>
            <div className="mt-8 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Delete Account</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Permanently remove your account and profile.
                  </p>
                </div>
                <ConfirmationDialog
                  trigger={
                    <button
                      type="button"
                      className="cursor-pointer text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete Account
                    </button>
                  }
                  title="Delete account?"
                  description="This action will permanently remove your account and profile. Do you want to proceed?"
                  confirmLabel="Delete Account"
                  cancelLabel="Keep Account"
                  destructive
                  onConfirm={() => undefined}
                />
              </div>
            </div>
            <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update profile photo</DialogTitle>
                  <DialogDescription>
                    Upload an image from your device or provide a public image
                    URL.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <input
                    ref={(node) => {
                      avatarInputRef.current = node;
                    }}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) =>
                      chooseAvatarFile(event.target.files?.[0])
                    }
                  />
                  {avatarPreview || avatarUrl ? (
                    <div
                      className="mx-auto h-56 w-56 touch-none cursor-grab overflow-hidden rounded-full border-4 border-primary/30 bg-muted active:cursor-grabbing"
                      onPointerDown={startAvatarDrag}
                      onPointerMove={moveAvatar}
                      onPointerUp={() => setDraggingAvatar(false)}
                      onPointerCancel={() => setDraggingAvatar(false)}
                    >
                      <img
                        src={avatarPreview || avatarUrl}
                        alt="Profile crop preview"
                        className="h-full w-full select-none object-cover transition-transform"
                        style={{
                          transform: `translate(${avatarPosition.x}px, ${avatarPosition.y}px) scale(${avatarZoom})`,
                        }}
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="mx-auto grid h-56 w-56 place-items-center rounded-full border-4 border-primary/20 bg-card text-4xl font-semibold text-primary">
                      {initials}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Label className="text-sm">Zoom</Label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={avatarZoom}
                      onChange={(event) =>
                        setAvatarZoom(Number(event.target.value))
                      }
                      className="w-full cursor-pointer accent-primary"
                      aria-label="Zoom profile image"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full cursor-pointer"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Upload /> Choose from device
                  </Button>
                  <div className="space-y-2">
                    <Label htmlFor="avatar-url">Image URL</Label>
                    <Input
                      id="avatar-url"
                      value={avatarFile ? "" : avatarUrl}
                      onChange={(event) => {
                        setAvatarFile(null);
                        setAvatarPreview("");
                        setAvatarUrl(event.target.value);
                      }}
                      placeholder="https://example.com/profile.jpg"
                      type="url"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setAvatarDialogOpen(false)}
                    disabled={savingAvatar}
                  >
                    Cancel
                  </Button>
                  <LoadingButton
                    type="button"
                    className="cursor-pointer"
                    onClick={() => void saveAvatar()}
                    loading={savingAvatar}
                    loadingLabel="Saving..."
                  >
                    Save Photo
                  </LoadingButton>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={bannerDialogOpen} onOpenChange={setBannerDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update profile banner</DialogTitle>
                  <DialogDescription>
                    Upload an image from your device or provide a public image
                    URL, then crop it for the banner frame.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) =>
                      chooseBannerFile(event.target.files?.[0])
                    }
                  />
                  {bannerPreview || bannerUrl ? (
                    <div
                      className="mx-auto h-40 w-full touch-none cursor-grab overflow-hidden rounded-lg border-4 border-primary/30 bg-muted active:cursor-grabbing"
                      onPointerDown={startBannerDrag}
                      onPointerMove={moveBanner}
                      onPointerUp={() => setDraggingBanner(false)}
                      onPointerCancel={() => setDraggingBanner(false)}
                    >
                      <img
                        src={bannerPreview || bannerUrl}
                        alt="Banner crop preview"
                        className="h-full w-full select-none object-cover"
                        style={{
                          transform: `translate(${bannerPosition.x}px, ${bannerPosition.y}px) scale(${bannerZoom})`,
                        }}
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="grid h-40 place-items-center rounded-lg bg-muted text-sm text-muted-foreground">
                      Banner preview
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Label className="text-sm">Zoom</Label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={bannerZoom}
                      onChange={(event) =>
                        setBannerZoom(Number(event.target.value))
                      }
                      className="w-full cursor-pointer accent-primary"
                      aria-label="Zoom profile banner"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full cursor-pointer"
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    <Upload /> Choose from device
                  </Button>
                  <div className="space-y-2">
                    <Label htmlFor="banner-url">Image URL</Label>
                    <Input
                      id="banner-url"
                      value={bannerFile ? "" : bannerUrl}
                      onChange={(event) => {
                        setBannerFile(null);
                        setBannerPreview("");
                        setBannerUrl(event.target.value);
                        setBannerZoom(1);
                        setBannerPosition({ x: 0, y: 0 });
                      }}
                      placeholder="https://example.com/banner.jpg"
                      type="url"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setBannerDialogOpen(false)}
                    disabled={savingBanner}
                  >
                    Cancel
                  </Button>
                  <LoadingButton
                    type="button"
                    className="cursor-pointer"
                    onClick={() => void saveBanner()}
                    loading={savingBanner}
                    loadingLabel="Saving..."
                  >
                    Save Banner
                  </LoadingButton>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </RimoraShell>
  );
};

export default EditProfile;
