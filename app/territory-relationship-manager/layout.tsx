import type { ReactNode } from "react";
import AppLayout from "@/components/territory-manager/AppLayout";

interface LayoutProps {
  children: ReactNode;
}

export default function TerritoryRelationshipManagerLayout({
  children,
}: LayoutProps) {
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
}