import { useEffect, useRef } from "react";

import { useToast } from "@comfama/comfama-ui-react";

/**
 * Muestra, una sola vez al montar, un toast recordando el cierre del período de
 * aportes. Usa una ref de guarda para evitar el doble disparo de StrictMode en
 * desarrollo.
 */
export const useAportesReminder = (): void => {
  const { toast } = useToast();
  const remindedRef = useRef(false);

  useEffect(() => {
    if (remindedRef.current) return;
    remindedRef.current = true;

    toast({
      type: "info",
      variant: "outline",
      title: "Cierre de aportes",
      description: "El cierre del período es el 05 de agosto. Revisa las solicitudes en revisión.",
      showIcon: true,
      showCloseButton: true,
      duration: 8000,
    });
  }, [toast]);
};
