import Image from "next/image";

type AuthLoadingScreenProps = {
  message: string;
};

export function AuthLoadingScreen({ message }: AuthLoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/images/logo-cp.png"
          alt="ITII Assist Classroom"
          width={60}
          height={60}
          priority
          className="h-15 w-15 rounded object-contain"
        />
        <p className="text-xl text-default-700">{message}</p>

        <div className="relative h-2 w-44 overflow-hidden rounded-full bg-default-200/90 dark:bg-default-700/90">
          <div className="loading-bar absolute inset-y-0 rounded-full bg-linear-to-r from-blue-400 via-indigo-500 to-blue-400" />
        </div>
      </div>

      <style jsx>{`
        .loading-bar {
          left: 0;
          width: 32%;
          animation: loading-bar-slide 2.2s linear infinite alternate;
          box-shadow: 0 0 0.45rem rgba(59, 130, 246, 0.55);
          will-change: left;
        }

        @keyframes loading-bar-slide {
          0% {
            left: 0%;
          }
          100% {
            left: 68%;
          }
        }
      `}</style>
    </div>
  );
}