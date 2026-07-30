# PROPHETIA — INSTRUCCIONES TEMPORALES PARA CODEX

Antes de modificar cualquier archivo:

1. Lee completamente `CODEX_FINAL_TASKS.md`.
2. Inspecciona el estado actual del repositorio.
3. Continúa desde el working tree existente.
4. Preserva todos los cambios válidos ya realizados.
5. No supongas que una tarea está terminada solo porque existan reglas CSS relacionadas.
6. Comprueba el resultado renderizado en navegador real.

## RESTRICCIONES ABSOLUTAS

- No ejecutar `git reset`, `git clean`, restauraciones globales ni operaciones destructivas.
- No crear ramas nuevas.
- No hacer commit.
- No hacer push.
- No desplegar en Render.
- No modificar ni mostrar secretos, `.env`, API keys o credenciales.
- No instalar dependencias salvo necesidad demostrada y autorización expresa.
- No duplicar componentes, drawers, menús, grids ni controladores existentes.
- No crear rutas o alias públicos inventados.
- No modificar precios, stock, Stripe, envíos, fiscalidad ni autenticación salvo lo solicitado expresamente.
- Mantener el checkout bloqueado hasta que existan tarifas reales de transporte verificadas.
- Mantener escritorio intacto salvo cuando `CODEX_FINAL_TASKS.md` indique expresamente una corrección de escritorio.

## MÉTODO OBLIGATORIO

- Auditar primero HTML, CSS, JavaScript y cascada efectiva.
- Identificar la regla causante antes de añadir otra regla.
- Priorizar Grid, Flexbox, `min()`, `max()`, `clamp()`, porcentajes y tamaños fluidos.
- Evitar dimensiones rígidas innecesarias.
- Evitar nuevas reglas page-specific cuando pueda emplearse la capa compartida.
- No solucionar problemas acumulando parches contradictorios.
- Comprobar estilos calculados, geometría, overflow y comportamiento funcional.
- Realizar cambios pequeños y trazables.
- Ejecutar las validaciones indicadas después de modificar código.
- Actualizar las casillas de `CODEX_FINAL_TASKS.md` únicamente cuando la tarea haya sido comprobada realmente.

## FINALIZACIÓN

No declares el trabajo terminado hasta:

- completar las tareas activas;
- validar todas las rutas y resoluciones;
- confirmar ausencia de regresiones de escritorio;
- ejecutar las comprobaciones técnicas;
- crear el informe solicitado.

Si una instrucción es ambigua o requiere inventar datos, detente e informa antes de modificarla.
