import Link from "next/link";
import FolioLogo from "../FolioLogo";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <FolioLogo size="md" variant="combined" />
    </Link>
  );
}

