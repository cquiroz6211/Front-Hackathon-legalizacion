import { LuBell, LuSearch } from "react-icons/lu";
import { useMatches } from "react-router-dom";

import { AuthWidget, Button, Typography, useToast } from "@comfama/comfama-ui-react";

/** Metadatos de título que cada ruta declara en su `handle`. */
export interface RouteHandle {
  title?: string;
  subtitle?: string;
}

/** Barra superior transversal: título de la ruta activa, búsqueda, notificaciones y sesión. */
export const AppHeader = () => {
  const { toast } = useToast();
  const matches = useMatches();

  const handle = [...matches]
    .reverse()
    .map((match) => match.handle as RouteHandle | undefined)
    .find((current) => current?.title);

  const title = handle?.title ?? "Comfama";
  const subtitle = handle?.subtitle;

  return (
    <header className="flex items-center justify-between gap-4 border-b border-secondary-400 bg-white px-8 py-4">
      <div>
        <Typography variant="h5" className="text-typography-dark">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" className="text-secondary-600">
            {subtitle}
          </Typography>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" isIcon size="sm" aria-label="Buscar">
          <LuSearch className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          isIcon
          size="sm"
          aria-label="Notificaciones"
          className="relative"
          action={() =>
            toast({
              type: "success",
              title: "Sin novedades",
              description: "No tienes notificaciones nuevas por ahora.",
              showIcon: true,
              showCloseButton: true,
              duration: 4000,
            })
          }
        >
          <LuBell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />
        </Button>

        <AuthWidget
          isLoggedIn
          variant="horizontal"
          name="Jorge Torres"
          home={{ label: "Inicio", action: "#" }}
          profile={{ label: "Mi perfil", action: "#" }}
          logout={{
            label: "Cerrar sesión",
            action: () =>
              toast({
                type: "info",
                title: "Sesión finalizada",
                description: "Has cerrado sesión correctamente.",
                showIcon: true,
                showCloseButton: true,
                duration: 4000,
              }),
          }}
        />
      </div>
    </header>
  );
};
