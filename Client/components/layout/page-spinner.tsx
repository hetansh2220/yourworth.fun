import Image from "next/image";

export function PageSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div aria-label={label} role="status">
        <Image
          src="/brand/logo.png"
          alt=""
          width={56}
          height={56}
          priority
          className="size-14 animate-spin rounded-xl"
        />
      </div>
    </div>
  );
}
