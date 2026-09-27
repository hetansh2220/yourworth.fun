import LoginProfile from "@/components/auth/login-profile";

export default function CompleteProfilePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-10 text-white">
      <section className="w-full max-w-2xl">
        <LoginProfile />
      </section>
    </main>
  );
}
