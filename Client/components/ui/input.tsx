import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-14 rounded-2xl border-white/10 bg-white/10 px-5 text-base text-white placeholder:text-white/50 sm:h-16 sm:text-md",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
