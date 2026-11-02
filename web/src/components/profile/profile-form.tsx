"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import {
  useCreateProfile,
  useUpdateProfile,
  useUsernameAvailability,
} from "@/hooks/use-profile";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  useCurrentProfile,
  useUpdateCurrentProfile,
} from "@/components/profile/profile-required";

export function ProfileForm({ mode = "edit" }: { mode?: "edit" | "create" }) {
  const isCreate = mode === "create";
  const currentProfile = useCurrentProfile();
  const updateCurrentProfile = useUpdateCurrentProfile();
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startingProfile =
    !isCreate && currentProfile
      ? {
          name: currentProfile.name,
          username: currentProfile.username,
          bio: currentProfile.bio,
          image: currentProfile.avatar,
        }
      : { name: "", username: "", bio: "", image: "" };
  const [saved, setSaved] = useState(startingProfile);
  const [profile, setProfile] = useState(startingProfile);
  const [status, setStatus] = useState("");
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRequest = useRef(0);
  const [photoLoading, setPhotoLoading] = useState(false);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const usernameAvailability = useUsernameAvailability(
    profile.username,
    currentProfile?.username,
  );

  function update(field: keyof typeof profile, value: string) {
    setProfile((previous) => ({ ...previous, [field]: value }));
    setStatus("");
  }

  async function selectPhoto(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setPhotoError("Choose a JPG, PNG, or WebP image under 5 MB.");
      return;
    }
    const request = ++photoRequest.current;
    setPhotoError("");
    setPhotoLoading(true);
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Image could not be read"));
        reader.readAsDataURL(file);
      });
      if (request === photoRequest.current) {
        update("image", image);
        setAvatarFile(file);
      }
    } catch {
      if (request === photoRequest.current)
        setPhotoError("Could not read this image. Please try another.");
    } finally {
      if (request === photoRequest.current) setPhotoLoading(false);
    }
  }

  return (
    <main className="w-full p-4 pt-8 sm:p-6 sm:pt-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-[32px] font-medium tracking-tight">
            {isCreate ? "Create profile" : "Edit profile"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCreate
              ? "Set up your photo and public profile details."
              : "Manage your photo and public profile details."}
          </p>
        </header>
        <Card className="bg-transparent ring-0">
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={async (event) => {
                event.preventDefault();
                if (submitting) return;
                if (
                  [
                    "dashboard",
                    "earnings",
                    "explore",
                    "chats",
                    "settings",
                    "create-profile",
                  ].includes(profile.username.toLowerCase())
                ) {
                  setStatus(
                    "This username is reserved. Please choose another.",
                  );
                  return;
                }
                if (isCreate) {
                  if (!authenticated) {
                    login();
                    return;
                  }
                  if (!profile.name.trim()) {
                    setStatus("Please enter a display name.");
                    return;
                  }
                  if (!avatarFile) {
                    setPhotoError("Please choose a profile photo.");
                    return;
                  }
                  if (!profile.bio.trim()) {
                    setStatus("Please add a bio.");
                    return;
                  }
                  setSubmitting(true);
                  setStatus("");
                  try {
                    await createProfile.mutateAsync({
                      username: profile.username.trim(),
                      name: profile.name.trim(),
                      bio: profile.bio.trim(),
                      avatar: avatarFile,
                    });
                    router.replace("/dashboard");
                  } catch (error) {
                    setStatus(
                      error instanceof Error
                        ? error.message
                        : "Could not create your profile.",
                    );
                  } finally {
                    setSubmitting(false);
                  }
                  return;
                }
                if (!authenticated) {
                  login();
                  return;
                }
                if (!profile.name.trim()) {
                  setStatus("Please enter a display name.");
                  return;
                }
                if (!profile.bio.trim()) {
                  setStatus("Please add a bio.");
                  return;
                }
                setSubmitting(true);
                setStatus("");
                try {
                  const user = await updateProfile.mutateAsync({
                    name: profile.name.trim(),
                    username: profile.username.trim(),
                    bio: profile.bio.trim(),
                    ...(avatarFile ? { avatar: avatarFile } : {}),
                  });
                  const updated = {
                    name: user.name,
                    username: user.username,
                    bio: user.bio,
                    image: user.avatar,
                  };
                  setSaved(updated);
                  setProfile(updated);
                  updateCurrentProfile?.(user);
                  toast.add({
                    title: "Profile updated",
                    description: "Your profile changes were saved.",
                    type: "success",
                  });
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : "Could not update your profile.";
                  setStatus(message);
                  toast.add({
                    title: "Profile update failed",
                    description: message,
                    type: "error",
                  });
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="relative shrink-0">
                  <Avatar className="size-24 after:rounded-full">
                    <AvatarImage src={profile.image} alt="Profile photo" />
                    <AvatarFallback className="text-2xl">
                      {profile.name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  {
                    <Button
                      type="button"
                      size="icon"
                      className="absolute bottom-0 right-0 size-6 ring-2 ring-background"
                      disabled={photoLoading}
                      aria-label={
                        photoLoading ? "Loading photo" : "Edit profile photo"
                      }
                      onClick={() => fileRef.current?.click()}
                    >
                      <PencilSimpleIcon className="size-3" aria-hidden="true" />
                    </Button>
                  }
                </div>
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="Upload profile photo"
                    onChange={(event) => {
                      void selectPhoto(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  {photoError && (
                    <p role="alert" className="text-xs text-destructive">
                      {photoError}
                    </p>
                  )}
                </div>
              </div>
              <fieldset disabled={submitting} className="grid gap-5">
                <div className="grid gap-2">
                  <label htmlFor="profile-name" className="text-sm">
                    Name
                  </label>
                  <Input
                    id="profile-name"
                    value={profile.name}
                    onChange={(event) => update("name", event.target.value)}
                    required
                    maxLength={60}
                    pattern=".*\S.*"
                    autoComplete="name"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="profile-username" className="text-sm">
                    Username
                  </label>
                  <Input
                    id="profile-username"
                    value={profile.username}
                    onChange={(event) => update("username", event.target.value)}
                    required
                    minLength={3}
                    maxLength={20}
                    pattern="[a-zA-Z0-9_]{3,20}"
                    title="Use 3–20 letters, numbers, or underscores."
                    autoComplete="username"
                    spellCheck={false}
                  />
                  {profile.username.trim().length >= 3 &&
                    !usernameAvailability.isCurrentUsername && (
                      <p
                        className={
                          usernameAvailability.data?.available
                            ? "text-xs text-emerald-500"
                            : "text-xs text-destructive"
                        }
                      >
                        {usernameAvailability.isFetching
                          ? "Checking username…"
                          : usernameAvailability.data?.available
                            ? "Username available"
                            : usernameAvailability.data
                              ? "Username already taken"
                              : ""}
                      </p>
                    )}
                </div>
              </fieldset>
              <div className="grid gap-2">
                <label htmlFor="profile-bio" className="text-sm">
                  Bio
                </label>
                <Textarea
                  disabled={submitting}
                  id="profile-bio"
                  value={profile.bio}
                  onChange={(event) => update("bio", event.target.value)}
                  required
                  maxLength={160}
                  className="min-h-28 resize-y"
                  placeholder="Tell people about yourself"
                  aria-describedby="bio-count"
                />
                <p
                  id="bio-count"
                  className="text-right text-xs text-muted-foreground"
                >
                  {profile.bio.length} / 160
                </p>
              </div>
              {status && (
                <p role="alert" className="text-sm text-destructive">
                  {status}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="submit"
                  className="h-11 text-base"
                  disabled={
                    !dirty || photoLoading || submitting || (isCreate && !ready)
                  }
                >
                  {submitting
                    ? isCreate
                      ? "Creating profile…"
                      : "Saving…"
                    : isCreate
                      ? "Create profile"
                      : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
