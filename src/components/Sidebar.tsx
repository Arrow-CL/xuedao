"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Map, Camera, BarChart3, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "学习地图", icon: Map },
  { href: "/solve", label: "做题", icon: BookOpen },
  { href: "/ocr", label: "拍照识题", icon: Camera },
  { href: "/errors", label: "错题本", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={"shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-200 " + (collapsed ? "w-16" : "w-52")}>
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200">
        {!collapsed && (
          <Link href="/" className="font-bold text-gray-800 text-sm tracking-tight">学导</Link>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-gray-600 text-xs p-1 rounded hover:bg-gray-200/50">
          {collapsed ? "▶" : "◀"}
        </button>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={"flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors " + (
                active
                  ? "bg-indigo-100 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              )}>
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-gray-200">
        {!collapsed && (
          <p className="text-xs text-gray-400 leading-relaxed">
            苏格拉底式数学自学
          </p>
        )}
      </div>
    </aside>
  );
}
