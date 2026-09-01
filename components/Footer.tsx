import Link from "next/link";

export function AppFooter() {
    return (
        <footer className="flex min-h-12 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 border-t border-divider bg-content1 px-4 py-3 text-center text-[13px] leading-relaxed text-default-500">
            <span>© 2026 COCO LABS -</span>
            <Link
                href="https://computing.kku.ac.th"
                target="_blank"
                rel="noopener noreferrer"
                className="text-default-500 underline-offset-2 transition-colors hover:text-primary-500 hover:underline"
            >
                College of Computing
            </Link>
            <span className="hidden sm:inline">|</span>
            <span className="w-full sm:w-auto">
                Developed by{" "}
                <Link
                    href="https://osp101.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-default-500 underline-offset-2 transition-colors hover:text-primary-500 hover:underline"
                >
                    ITII Development Team
                </Link>
            </span>
        </footer>
    );
}

export default AppFooter;
