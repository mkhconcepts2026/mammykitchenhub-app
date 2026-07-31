"use client";

import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden">

    <AppSidebar />

      {/* Main Workspace */}
      <div className="flex flex-col flex-1 overflow-hidden">

        <AppHeader />

        {/* Page Content */}

        <main className="flex-1 overflow-y-auto p-8">

          {children}

        </main>

      </div>

    </div>
  );
}