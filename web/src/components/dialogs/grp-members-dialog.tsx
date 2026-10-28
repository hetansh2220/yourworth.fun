"use client";

import type { ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export type GroupMember = {
    id: string;
    name: string;
    initials: string;
    avatar?: string | null;
};

export default function GrpMembersDialog({
    members,
    children,
}: {
    members: GroupMember[];
    children: ReactNode;
}) {
    return (
        <Dialog>
            <DialogTrigger
                nativeButton={false}
                render={<span className="contents" />}
            >
                {children}
            </DialogTrigger>
            <DialogContent
                showCloseButton={false}
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 sm:max-w-md"
            >
                <DialogHeader>
                    <div className="flex items-center justify-between gap-4">
                        <DialogTitle className="text-lg">
                            Group members ({members.length})
                        </DialogTitle>
                        <DialogClose
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-9 rounded-lg border border-border text-muted-foreground hover:text-foreground"
                                />
                            }
                            aria-label="Close"
                        >
                            <XIcon className="size-5" aria-hidden="true" />
                        </DialogClose>
                    </div>
                    <DialogDescription className="sr-only">
                        View all members in this group chat.
                    </DialogDescription>
                </DialogHeader>
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {members.map((member) => (
                        <li
                            key={member.id}
                            className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
                        >
                            <Avatar>
                                {member.avatar ? (
                                    <AvatarImage src={member.avatar} alt="" />
                                ) : null}
                                <AvatarFallback>
                                    {member.initials}
                                </AvatarFallback>
                            </Avatar>
                            <span className="truncate font-semibold text-md">
                                {member.name}
                            </span>
                        </li>
                    ))}
                </ul>
            </DialogContent>
        </Dialog>
    );
}
