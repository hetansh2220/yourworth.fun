"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { StarIcon, XIcon } from "@phosphor-icons/react";
import { useCreateReview } from "@/hooks/use-reviews";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

type ReviewDialogProps = {
    reviewedUserId: string;
    name: string;
    avatar?: string;
    children?: ReactNode;
};

export function ReviewDialog({
    reviewedUserId,
    name,
    avatar,
    children,
}: ReviewDialogProps) {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const id = useId();
    const createReview = useCreateReview();

    function reset() {
        setRating(0);
        setComment("");
        createReview.reset();
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!rating) return;

        try {
            await createReview.mutateAsync({
                reviewedUserId,
                rating,
                comment: comment.trim() || null,
            });
            toast.add({
                title: "Review submitted",
                description: "Thanks for sharing your experience.",
                type: "success",
            });
            reset();
        } catch (error) {
            toast.add({
                title: "Could not submit review",
                description:
                    error instanceof Error
                        ? error.message
                        : "Please try again.",
                type: "error",
            });
        }
    }

    return (
        <Dialog
            onOpenChange={(open) => {
                if (!open) reset();
            }}
        >
            {children ? (
                <DialogTrigger
                    nativeButton={false}
                    render={<span className="cursor-pointer" />}
                >
                    {children}
                </DialogTrigger>
            ) : (
                <DialogTrigger render={<Button variant="outline" />}>
                    Leave a review
                </DialogTrigger>
            )}
            <DialogContent
                showCloseButton={false}
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 sm:max-w-md"
            >
                <DialogHeader>
                    <div className="flex items-center justify-between gap-4">
                        <DialogTitle className="text-lg font-medium">
                            How was your experience?
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
                        Leave a rating and review for {name}.
                    </DialogDescription>
                </DialogHeader>
                <form className="space-y-5" onSubmit={submit}>
                    <fieldset className="space-y-2">
                        <div
                            className="flex w-full justify-center gap-3"
                            role="radiogroup"
                            aria-label="Rating"
                        >
                            {[1, 2, 3, 4, 5].map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={rating === value}
                                    aria-label={`${value} stars`}
                                    onClick={() => setRating(value)}
                                    className="rounded-lg p-2 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <StarIcon
                                        size={44}
                                        weight={
                                            value <= rating ? "fill" : "regular"
                                        }
                                        className={
                                            value <= rating
                                                ? "text-yellow-400"
                                                : "text-muted-foreground"
                                        }
                                        aria-hidden="true"
                                    />
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    <div className="space-y-2 flex flex-col">
                        <label htmlFor={id} className="text-lg font-medium">
                            Your message
                        </label>
                        <Textarea
                            id={id}
                            value={comment}
                            onChange={(event) => setComment(event.target.value)}
                            maxLength={2000}
                            placeholder="Share your experience"
                            className="min-h-28 resize-y"
                        />
                    </div>
                    <Button
                        type="submit"
                        className="h-11 w-full text-base"
                        disabled={!rating || createReview.isPending}
                    >
                        {createReview.isPending
                            ? "Submitting…"
                            : "Submit review"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default ReviewDialog;
