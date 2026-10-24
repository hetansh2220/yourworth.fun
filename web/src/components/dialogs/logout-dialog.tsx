"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignOutIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";

export function LogoutDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <SidebarMenuButton className="h-[42px] gap-3 cursor-pointer rounded-md px-4 text-sm text-red-400 hover:bg-transparent hover:text-red-400 active:bg-transparent active:text-red-400 [&>svg]:size-5" />
        }
      >
        <SignOutIcon aria-hidden="true" />
        <span>Logout</span>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="gap-6 rounded-2xl p-6 sm:max-w-sm"
      >
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl">Logout?</DialogTitle>
          <DialogDescription className="text-sm">
            Are you sure you want to log out?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3">
          <DialogClose render={<Button variant="outline" className="flex-1" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            className="flex-1 border-red-500 bg-red-600 bg-none text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            onClick={() => {
              setOpen(false);
              setOpenMobile(false);
              router.push("/");
            }}
          >
            Logout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
