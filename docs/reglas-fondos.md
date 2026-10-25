# Reglas de asignación de fondos (vigentes)

Estas reglas se implementan en el módulo Fondos (no en el de autenticación). Quedan fijadas aquí antes de empezar ese módulo.

## Corrección de la decisión de arquitectura de la ETAPA 2

La ETAPA 2 proponía permitir que una parte de un gasto quedara **sin imputar** cuando ningún fondo lo cubriera del todo. **Esa decisión queda anulada.** No existe el estado "sin imputar".

## Regla vigente

1. Un gasto se asigna primero a los fondos específicos que cubren su clasificación y su medio de pago, en el orden de prioridad configurado.
2. El **excedente** que los fondos específicos no cubren lo absorbe el **Fondo General** cuando las reglas del Fondo General admiten esa combinación de clasificación y medio de pago.
3. El Fondo General **puede quedar con saldo negativo**. Un saldo negativo por sí solo nunca impide guardar un gasto.
4. Si **ningún fondo** admite la combinación de clasificación y medio de pago, el gasto se **bloquea**: no se guarda.
5. Toda parte de un gasto guardado queda imputada a algún fondo y la interfaz muestra qué parte fue a cada uno.

## Caso por definir (se resolverá en el hito del módulo Fondos)

Un fondo específico admite la combinación, pero se agota, y el Fondo General **no** la admite. La regla anterior solo bloquea cuando ningún fondo admite la combinación, así que no dice qué hacer con el excedente. No se implementa ninguna suposición: se presentará la propuesta al usuario en la revisión del módulo Fondos. Mientras no se decida, la implementación no puede dejar ese excedente sin imputar.
