import { Link } from "react-router-dom";
import {
  LuArrowLeft,
  LuBell,
  LuCircleHelp,
} from "react-icons/lu";

import { Button, Typography } from "@comfama/comfama-ui-react";

/** Path público: servido por Vite desde /public. Usamos string literal para
 *  evitar que el pipeline de Vitest tenga que transformar el asset. */
const COMFAMA_LOGO_SRC = "/comfama-logo.svg";

export type LegalizacionVariant = "me" | "upload" | "review";

interface LegalizacionHeaderProps {
  variant: LegalizacionVariant;
}

const USER_NAME = "Juan Pérez";
const USER_ID = "12.345.678";

/**
 * Header dedicado de las 3 vistas de legalización (`/me`, `/upload`, `/review`).
 * Sustituye al shell global (`AppHeader` + `AppSidebar`) para dar identidad
 * propia al flujo, manteniendo los tokens del design system Comfama.
 */
export const LegalizacionHeader = ({ variant }: LegalizacionHeaderProps) => (
  <header className="flex items-center justify-between gap-4 border-b border-secondary-400 bg-white px-6 h-16 sticky top-0 z-40">
    <div className="flex items-center gap-4">
      <Link to="/" aria-label="Inicio">
        <img src={COMFAMA_LOGO_SRC} alt="Comfama" width={143} height={24} />
      </Link>

      {variant === "review" && (
        <>
          <div className="hidden md:block h-8 w-px bg-secondary-400 mx-2" />
          <div className="hidden md:flex flex-col">
            <Typography
              variant="subtitle2"
              className="text-secondary-600 uppercase tracking-wider"
            >
              Operador
            </Typography>
            <Typography variant="body1" className="font-semibold text-secondary-900">
              {USER_NAME} <span className="font-normal opacity-70">(ID: {USER_ID})</span>
            </Typography>
          </div>
        </>
      )}
    </div>

    <div className="flex items-center gap-3">
      {(variant === "upload" || variant === "me") && (
        <div className="hidden md:flex flex-col items-end mr-4">
          <Typography variant="subtitle2" className="font-semibold text-secondary-900">
            {USER_NAME}
          </Typography>
          <Typography
            variant="body2"
            className="text-secondary-600 uppercase tracking-wider"
          >
            ID: {USER_ID}
          </Typography>
        </div>
      )}

      {variant === "me" && (
        <Button
          variant="ghost"
          isIcon
          size="sm"
          aria-label="Volver"
          action={() => undefined}
          className="hidden md:inline-flex"
        >
          <LuArrowLeft className="h-5 w-5 text-secondary-600" />
        </Button>
      )}

      <Button
        variant="ghost"
        isIcon
        size="sm"
        aria-label="Notificaciones"
        action={() => undefined}
        className="relative"
      >
        <LuBell className="h-5 w-5 text-secondary-600" />
        {variant === "review" && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />
        )}
      </Button>

      <Button
        variant="ghost"
        isIcon
        size="sm"
        aria-label="Ayuda"
        action={() => undefined}
      >
        <LuCircleHelp className="h-5 w-5 text-secondary-600" />
      </Button>

      <Link
        to="/me"
        className="h-9 w-9 rounded-full border border-secondary-400 bg-secondary-100 flex items-center justify-center overflow-hidden"
        aria-label="Mi perfil"
      >
        <span className="text-secondary-700 text-xs font-semibold">
          {USER_NAME.split(" ").map((p) => p[0]).join("")}
        </span>
      </Link>
    </div>
  </header>
);