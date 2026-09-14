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
} from "lucide-react";
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
  // {
  //   title: "Members",
  //   url: "/admin/members",
  //   icon: Users,
  // },
  // {
  //   title: "Events",
  //   url: "/admin/events",
  //   icon: Calendar,
  // },
  // {
  //   title: "Event Manager",
  //   url: "/admin/managed-events",
  //   icon: CalendarCheck,
  // },
  {
    title: "Users",
    url: "/admin/users",
    icon: UsersRound,
  },
  // {
  //   title: "Forms",
  //   url: "/admin/forms",
  //   icon: FileText,
  // },
  // {
  //   title: "Form Builder",
  //   url: "/admin/form-builder",
  //   icon: FileText,
  // },
  // {
  //   title: "Image to Url",
  //   url: "/admin/image-to-url",
  //   icon: Link2,
  // },
  // {
  //   title: "Gallery",
  //   url: "/admin/gallery",
  //   icon: Image,
  // },
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
  // {
  //   title: "Settings",
  //   url: "/admin/settings",
  //   icon: Settings,
  // },
];

export function AppSidebar() {
  const router = useRouter();

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
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
         
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
