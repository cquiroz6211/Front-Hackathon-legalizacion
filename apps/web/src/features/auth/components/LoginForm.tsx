import { useId, useState } from "react";

import { LuEye, LuEyeOff, LuLockKeyhole, LuUser } from "react-icons/lu";

import {
  Alert,
  Button,
  Input,
  RadioButton,
  RadioGroup,
  Typography,
} from "@comfama/comfama-ui-react";

import { authRoleLabel, signIn, validateCredentials } from "../lib/auth";
import type { AuthRole } from "../types";
import { AUTH_ROLES } from "../types";

interface LoginFormProps {
  /**
   * Llamado tras un `signIn` exitoso. La responsabilidad de navegar
   * (incluyendo `replace`) queda en el caller.
   */
  onAuthenticated: () => void;
}

/**
 * Formulario de login mock para el hackatón.
 *
 * Comportamiento:
 * - Valida identifier/password/role antes de "autenticar" (mock).
 * - Muestra errores inline cerca del campo correspondiente.
 * - Permite alternar visibilidad de la contraseña.
 * - Deshabilita el submit mientras valida o procesa.
 */
export const LoginForm = ({ onAuthenticated }: LoginFormProps) => {
  const identifierId = useId();
  const passwordId = useId();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<AuthRole | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const identifierError = !identifier.trim() && error ? "Ingresa tu usuario." : null;
  const passwordError = identifier.trim() && !password ? "Ingresa tu contraseña." : null;
  const passwordLengthError =
    identifier.trim() && password && password.length < 4 && error
      ? "La contraseña debe tener al menos 4 caracteres."
      : null;

  const roleError = !role && error ? "Selecciona un rol." : null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateCredentials({
      identifier,
      password,
      role: role || undefined,
    });
    if (!validation.isValid) {
      setError(validation.message);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    // Latencia simulada para mostrar feedback de carga.
    window.setTimeout(() => {
      try {
        signIn({
          identifier,
          password,
          role: role as AuthRole,
        });
        onAuthenticated();
      } catch (err) {
        setIsSubmitting(false);
        setError(
          err instanceof Error ? err.message : "No pudimos iniciar sesión. Inténtalo nuevamente.",
        );
      }
    }, 600);
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="w-full space-y-6"
      aria-label="Formulario de inicio de sesión"
    >
      {error ? (
        <div role="alert" aria-live="polite" data-testid="login-form-error">
          <Alert
            variant="filled"
            type="error"
            title="No pudimos iniciar sesión"
            description={error}
            showIcon
          />
        </div>
      ) : null}

      <div className="space-y-4">
        <Input
          id={identifierId}
          name="identifier"
          type="text"
          autoComplete="username"
          label="Usuario"
          required
          helperText={identifierError ?? undefined}
          colorScheme={identifierError ? "error" : "default"}
          leftIcon={<LuUser className="h-4 w-4" aria-hidden="true" />}
          value={identifier}
          onChange={(event) => {
            setIdentifier(event.target.value);
            if (error) setError(null);
          }}
          disabled={isSubmitting}
        />

        <Input
          id={passwordId}
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          label="Contraseña"
          required
          helperText={passwordError ?? passwordLengthError ?? undefined}
          colorScheme={passwordError || passwordLengthError ? "error" : "default"}
          leftIcon={<LuLockKeyhole className="h-4 w-4" aria-hidden="true" />}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) setError(null);
          }}
          disabled={isSubmitting}
          aria-describedby={`${passwordId}-toggle`}
        />
        <div className="flex items-center justify-end">
          <Button
            id={`${passwordId}-toggle`}
            type="button"
            variant="text"
            size="sm"
            action={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            disabled={isSubmitting}
          >
            {showPassword ? (
              <LuEyeOff className="h-4 w-4 mr-2" aria-hidden="true" />
            ) : (
              <LuEye className="h-4 w-4 mr-2" aria-hidden="true" />
            )}
            {showPassword ? "Ocultar" : "Mostrar"}
          </Button>
        </div>

        <RadioGroup
          name="auth-role"
          legend="Rol"
          value={role}
          onChange={(value) => {
            setRole(value as AuthRole);
            if (error) setError(null);
          }}
          error={roleError ?? undefined}
          disabled={isSubmitting}
        >
          {AUTH_ROLES.map((value) => (
            <RadioButton
              key={value}
              value={value}
              label={authRoleLabel(value)}
              disabled={isSubmitting}
            />
          ))}
        </RadioGroup>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? "Ingresando…" : "Ingresar"}
      </Button>

      <Typography variant="body2" className="text-secondary-600 text-center" role="note">
        Demo de hackatón · la autenticación es simulada y se persiste en este navegador.
      </Typography>
    </form>
  );
};
