"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Folder, FileText, Home } from "lucide-react";

export default function DemoFlowNavigation() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session?.user?.id) return null;

  const navItems = [
    {
      label: "Events",
      href: "/events",
      icon: Calendar,
      description: "RSVP and save products"
    },
    {
      label: "Folders",
      href: "/designer/folders",
      icon: Folder,
      description: "Manage project folders"
    },
    {
      label: "Create Post",
      href: "/designer/posts/new",
      icon: FileText,
      description: "Create posts from folders"
    }
  ];

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
                title={item.description}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
