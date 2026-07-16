import { useNavigate } from "react-router-dom";

import { Typography } from "@comfama/comfama-ui-react";

import { LoginForm } from "../components/LoginForm";
import { getSession, homePathForRole } from "../lib/auth";

/** Path del logo oficial servido por Vite (carpeta public). */
const COMFAMA_LOGO_SRC = "/comfama-logo.svg";

/**
 * Página de inicio de sesión (rutas `/` y `/login`).
 *
 * Reemplaza la vista genérica de panel para el caso de uso del hackatón.
 * Tras un login válido, navega a la home del rol con `replace` para que la
 * ruta de login no quede en el historial (`gestor-sap` → `/gestor`,
 * `colaborador` → `/upload`).
 */
export const LoginPage = () => {
  const navigate = useNavigate();
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-secondary-100 px-6 py-12"
      aria-labelledby="login-page-title"
    >
      <section className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm border border-secondary-400">
        <header className="flex flex-col items-center text-center space-y-4">
          <img
            src={COMFAMA_LOGO_SRC}
            alt="Comfama"
            width={143}
            height={24}
            className="h-6 w-auto"
          />
          <div className="space-y-1">
            <Typography id="login-page-title" variant="h3" className="text-secondary-900">
              Iniciar sesión
            </Typography>
            <Typography variant="body2" className="text-secondary-600">
              Selecciona tu rol para acceder a la plataforma de legalizaciones.
            </Typography>
          </div>
        </header>

        <LoginForm
          onAuthenticated={() => navigate(homePathForRole(getSession()?.role ?? "colaborador"), { replace: true })}
        />
      </section>
    </main>
  );
};
