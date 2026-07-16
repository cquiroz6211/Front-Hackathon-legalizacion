import type { ReactNode } from "react";
import {
  LuBuilding2,
  LuHeartHandshake,
  LuLayoutDashboard,
  LuLifeBuoy,
  LuSettings,
  LuUsers,
  LuWallet,
} from "react-icons/lu";
import { useLocation, useNavigate } from "react-router-dom";

import { Sidebar } from "@comfama/comfama-ui-react";
import type { SidebarNavItem, SidebarSection } from "@comfama/comfama-ui-react";

/** Entrada de navegación del baseline. Sin `path` ⇒ ítem placeholder (deshabilitado). */
interface NavEntry {
  id: string;
  label: string;
  icon: ReactNode;
  path?: string;
  count?: number;
}

const generalNav: NavEntry[] = [
  { id: "panel", label: "Panel", icon: <LuLayoutDashboard />, path: "/" },
  { id: "afiliaciones", label: "Afiliaciones", icon: <LuUsers />, path: "/afiliaciones", count: 8 },
  { id: "empresas", label: "Empresas", icon: <LuBuilding2 /> },
  { id: "aportes", label: "Aportes", icon: <LuWallet /> },
];

const gestionNav: NavEntry[] = [
  { id: "beneficios", label: "Beneficios", icon: <LuHeartHandshake /> },
];

const footerNav: NavEntry[] = [
  { id: "ajustes", label: "Ajustes", icon: <LuSettings /> },
  { id: "ayuda", label: "Ayuda", icon: <LuLifeBuoy /> },
];

/** Navegación lateral transversal a toda la app (client-side routing). */
export const AppSidebar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path?: string) => {
    if (!path) return false;
    return path === "/" ? pathname === "/" : pathname.startsWith(path);
  };

  const toItem = (entry: NavEntry): SidebarNavItem => ({
    id: entry.id,
    label: entry.label,
    icon: entry.icon,
    count: entry.count,
    active: isActive(entry.path),
    disabled: !entry.path,
    onClick: entry.path ? () => navigate(entry.path as string) : undefined,
  });

  const sections: SidebarSection[] = [
    { id: "general", title: "General", items: generalNav.map(toItem) },
    { id: "gestion", title: "Gestión", items: gestionNav.map(toItem) },
  ];

  return (
    <Sidebar
      logo={
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-medium text-white">
          C
        </span>
      }
      title="Comfama"
      subtitle="Panel administrativo"
      sections={sections}
      footerItems={footerNav.map(toItem)}
      defaultCollapsed={false}
    />
  );
};
