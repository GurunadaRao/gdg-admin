"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import {
  Home,
  Users,
  UsersRound,
  Calendar,
  CalendarCheck,
  Settings,
  BarChart3,
  Menu,
  Camera,
  FileText,
  Link2,
  Image,
  LogOut,
  ShieldCheck,
  Briefcase,
  UserCog,
  ShieldEllipsis,
  User
} from "lucide-react";
import { useEffect, useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const menuItems = [
  // {
  //   title: "Dashboard",
  //   url: "/admin/dashboard",
  //   icon: Home,
  // },
  {
    title: "Members",
    url: "/admin/members",
    icon: Users,
  },
  {
    title: "Events",
    url: "/admin/events",
    icon: Calendar,
  },
  {
    title: "Event Manager",
    url: "/admin/managed-events",
    icon: CalendarCheck,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: UsersRound,
  },
  {
    title: "Forms",
    url: "/admin/forms",
    icon: FileText,
  },
  {
    title: "Form Builder",
    url: "/admin/form-builder",
    icon: FileText,
  },
  {
    title: "Image to Url",
    url: "/admin/image-to-url",
    icon: Link2,
  },
  {
    title: "Gallery",
    url: "/admin/gallery",
    icon: Image,
  },
  {
    title: "GDG Team",
    url: "/admin/gdg-team",
    icon: ShieldCheck,
  },
  {
    title: "Recruitment",
    url: "/admin/recruitment",
    icon: Briefcase,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
    module: "settings",
  },
  {
    title: "Admin Users",
    url: "/admin/admins",
    icon: UserCog,
    module: "users", // Or we could use a specific module, let's use 'users' or 'dashboard' but only if L0? We can allow L0 only, let's require 'settings' module for now.
  },
  {
    title: "Roles & Permissions",
    url: "/admin/roles",
    icon: ShieldEllipsis,
    module: "settings", // Only L0 has settings usually, or they can manage roles
  }
];

export function AppSidebar() {
  const router = useRouter();
  const [userModules, setUserModules] = useState<string[] | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setUserModules(data.user.modules || []);
          setRoleId(data.user.roleId || null);
        }
      })
      .catch(console.error);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <SidebarTrigger />
          <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">
            GDG Admin
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                // If it's Admins or Roles, only show to L0 for now, or those with canManageRoles
                // The API protects it anyway, but we'll hide it for non-L0
                if ((item.url === "/admin/admins" || item.url === "/admin/roles") && roleId !== "L0") {
                  return null;
                }
                
                // For other items, check module map
                const moduleName = item.url.split("/")[2] || "";
                
                // If userModules is null (loading) or empty, maybe show nothing or wait
                if (userModules && !userModules.includes(moduleName) && moduleName !== "admins" && moduleName !== "roles") {
                  return null;
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
         
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Profile">
              <Link href="/admin/profile">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
