"use client";

import { useRef, useState, type FormEvent } from "react";
import { PaperclipIcon, PaperPlaneTiltIcon, FileIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentGroup, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment";

export type ChatAttachment = { id: string; name: string; size: number };

export function ChatComposer({ onSend }: { onSend: (text: string, attachments: ChatAttachment[]) => void }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() && attachments.length === 0) return;
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
  }

  return (
    <form onSubmit={send} className="space-y-3 border-t border-white/5 bg-card/60 p-4">
      {attachments.length > 0 ? (
        <AttachmentGroup>
          {attachments.map((attachment) => (
            <Attachment key={attachment.id} state="idle">
              <AttachmentMedia><FileIcon aria-hidden="true" /></AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{attachment.name}</AttachmentTitle>
                <AttachmentDescription>{Math.max(1, Math.ceil(attachment.size / 1024))} KB · Local preview</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}>
                  <XIcon aria-hidden="true" />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      ) : null}
      <div className="flex items-center gap-2">
        <input ref={fileInput} type="file" multiple hidden onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          setAttachments((current) => [...current, ...files.map((file) => ({ id: crypto.randomUUID(), name: file.name, size: file.size }))]);
          event.target.value = "";
        }} />
        <button type="button" className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Attach files" onClick={() => fileInput.current?.click()}><PaperclipIcon className="size-5" aria-hidden="true" /></button>
        <Input className="border-white/10 bg-background dark:bg-background" aria-label="Message" placeholder="Type a message…" value={text} onChange={(event) => setText(event.target.value)} />
        <Button type="submit" size="icon" aria-label="Send message" disabled={!text.trim() && attachments.length === 0}><PaperPlaneTiltIcon aria-hidden="true" /></Button>
      </div>
    </form>
  );
}
