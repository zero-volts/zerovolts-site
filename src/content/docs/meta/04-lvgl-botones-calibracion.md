---
title: LVGL y RPi - Primer Botón
description: Crea un botón en LVGL y calibra una pantalla touch SPI con evdev.
fechaCreacion: "2026-11-02"
sidebar:
  order: 4
---

En este tutorial crearemos un botón con LVGL y configuraremos el touch para que las pulsaciones coincidan con la imagen. Al pulsar el botón, la aplicación escribirá un mensaje en la terminal.

Continuaremos con la Raspberry Pi y la pantalla touch SPI de 3,5 pulgadas con XPT2046. Para preparar el hardware, consulta [Pantalla SPI XPT2046 en Raspberry Pi](/meta/02-rpi-xpt2046/). Para instalar y compilar LVGL con fbdev, consulta [Hola LVGL en Raspberry Pi](/meta/03-lvgl-raspberry/).

## 1. Habilitar la entrada del touch

En el tutorial anterior usamos **fbdev** para mostrar imágenes en el framebuffer de Linux. Para recibir pulsaciones también necesitamos **evdev**, la interfaz que entrega a las aplicaciones los eventos de los dispositivos de entrada. Por eso un botón puede aparecer en pantalla sin responder al touch.

En `~/lv_port_linux`, abre el archivo `.config` que utilizaste para compilar LVGL y añade o ajusta esta opción sin duplicarla:

```text
CONFIG_LV_USE_EVDEV=y
```

La opción incorpora el controlador evdev a LVGL. Guarda el archivo y, desde la raíz del port, vuelve a configurar y compilar:

```bash
cmake -S . -B build
cmake --build build -j "$(nproc)"
```

El primer comando aplica la configuración y genera los archivos en `build`; el segundo recompila la biblioteca usando los procesadores disponibles. Al finalizar, la aplicación y la biblioteca utilizarán la configuración generada en `build/lvgl/autoconf.h`.

## 2. Identificar el dispositivo y medir las coordenadas

Ejecuta en la Raspberry Pi:

```bash
cat /proc/bus/input/devices
```

Busca el bloque del touch, que puede llamarse `ADS7846 Touchscreen`. En su línea `Handlers`, un nombre como `event4` corresponde a `/dev/input/event4`. El número puede variar entre equipos o inicios: anota el que corresponda a tu pantalla.

Para observar los valores que entrega el controlador, usa `evtest`. Si todavía no está instalado, ejecuta `sudo apt install evtest`, que instala el paquete en una distribución basada en Debian. Después, reemplaza `event4` por el dispositivo identificado:

```bash
sudo evtest /dev/input/event4
```

Toca las cuatro esquinas y anota los valores `ABS_X` y `ABS_Y`. Son coordenadas del controlador, no posiciones en píxeles. `SYN_REPORT` marca el final de un grupo de eventos; si un eje no cambió, puede que su último valor no se repita. Detén `evtest` con Ctrl+C.

En la pantalla del ejemplo se intercambian los ejes antes de calibrar: la coordenada horizontal utilizada por LVGL procede de `ABS_Y` y la vertical de `ABS_X`. Anota los valores intercambiados de la esquina superior izquierda y después los de la inferior derecha. Si al moverte hacia la derecha o hacia abajo el valor disminuye, conserva el orden de las esquinas, aunque el primer número sea mayor. Si tu eje horizontal ya corresponde a `ABS_X`, prueba sin intercambiar los ejes.

Por ejemplo, si las lecturas son `(ABS_X, ABS_Y) = (294, 296)` arriba a la izquierda y `(3843, 3931)` abajo a la derecha, después del intercambio los argumentos son `(296, 294, 3931, 3843)`. Estos son los valores utilizados en el ejemplo de referencia; adapta los tuyos a tu pantalla y orientación.

## 3. Crear la aplicación

Crea una carpeta para la aplicación y abre el archivo fuente:

```bash
mkdir -p ~/boton-lvgl
cd ~/boton-lvgl
nano main.c
```

`mkdir -p` crea la carpeta si falta; `nano` abre el editor. Copia el siguiente código de [main_touch_calibration.c](https://github.com/zero-volts/zerovolts-ui/blob/main/examples/main_touch_calibration.c):
```c
#include "lvgl.h"
#include "lv_linux_fbdev.h"
#include <unistd.h>
#include <stdio.h>


static void btn_event_cb(lv_event_t * e)
{
     printf("button pressed \n");
}

int driver_initialization(lv_display_t *display)
{
    lv_linux_fbdev_set_file(display, "/dev/fb0");
    // To know the event we use "cat /proc/bus/input/devices"
    lv_indev_t *touch = lv_evdev_create(LV_INDEV_TYPE_POINTER, "/dev/input/event4");
    if (!touch)
        return -1;

    // We swap axes because LVGL don't know that the screen is rotated 90degrees, so with
    // this swap the input are fixed internally.
    lv_evdev_set_swap_axes(touch, true);

    // We use evtest /dev/input/event4 command to know the screen edges points.
    lv_evdev_set_calibration(touch, 296, 294, 3931, 3843);

    return 0;
}

int main(void)
{ 
    lv_init();

    lv_display_t *display = lv_linux_fbdev_create();
    if (!display)
    {
        printf("Can't create the display!\n");
        return -1;
    }

    int sucess = driver_initialization(display);
    if (sucess == -1)
    {
        printf("Can't initialize the driver!\n");
        return -1;
    }

    lv_obj_t *active_screen = lv_screen_active();

    lv_obj_t *btn = lv_button_create(active_screen);
    lv_obj_align(btn, LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_size(btn, 120, 50);
    lv_obj_add_event_cb(btn, btn_event_cb, LV_EVENT_CLICKED, NULL);

    lv_obj_t *label = lv_label_create(btn);
    lv_label_set_text(label, "Button");
    lv_obj_center(label);
    
     while(1) {
         lv_timer_handler();
         usleep(5000);
    }

    return 0;
}
```

Guarda con Ctrl+O, Enter y Ctrl+X. Antes de compilar, cambia `/dev/fb0` y `/dev/input/event4` si tus dispositivos tienen otros nombres. Ajusta los cuatro valores de calibración según tus mediciones y, si no necesitas intercambiar los ejes, cambia `true` por `false`.

### Entrada y calibración

`lv_init()` prepara LVGL y `lv_linux_fbdev_create()` crea el objeto de pantalla. `driver_initialization()` asocia ese objeto al framebuffer mediante `lv_linux_fbdev_set_file()` y después abre el touch con `lv_evdev_create()`. El argumento `LV_INDEV_TYPE_POINTER` indica que la entrada proporciona una posición y un estado de pulsación, como un puntero. Si no se puede crear el dispositivo de entrada.


`lv_evdev_set_swap_axes(touch, true)` intercambia las coordenadas X e Y. Esto compensa la orientación utilizada en esta configuracion; rotar la imagen no necesariamente rota los datos del touch. A continuación, `lv_evdev_set_calibration(touch, 296, 294, 3931, 3843)` recibe, en orden, las coordenadas horizontal y vertical de la esquina superior izquierda y las de la inferior derecha, **después del swap**.

LVGL transforma cada eje linealmente para relacionar esos extremos con los bordes de la pantalla. Esto ajusta desplazamiento y escala dentro de la aplicación; no cambia la calibración global de Linux. Si el centro sigue desviado después de ajustar las esquinas, una transformación lineal por eje puede no ser suficiente.

### Botón y eventos

`lv_screen_active()` obtiene la pantalla activa. `lv_button_create(active_screen)` crea un botón dentro de ella; la pantalla es su **objeto padre**. `lv_obj_align()` centra el botón con desplazamiento horizontal y vertical cero, y `lv_obj_set_size()` le asigna un tamaño de 120 × 50 píxeles.

`lv_obj_add_event_cb()` registra `btn_event_cb` como función de respuesta o *callback*. `LV_EVENT_CLICKED` selecciona el evento de clic; el último argumento, `NULL`, indica que no se pasan datos adicionales. Cuando se completa un clic, la función imprime `button pressed` en la terminal.

La etiqueta se crea con `lv_label_create(btn)`: al ser hija del botón, `lv_obj_center(label)` la centra dentro de él. 

## 4. Compilar y probar

Comprueba el acceso a ambos dispositivos, sustituyendo las rutas si corresponde:

```bash
ls -l /dev/fb0 /dev/input/event4
groups
```

`ls -l` muestra propietario, grupo y permisos; `groups` muestra los grupos del usuario. La aplicación necesita escribir en el framebuffer y leer el dispositivo touch. Si falta acceso, revisa los grupos indicados por los dispositivos. Tras cambiar los grupos de un usuario, cierra sesión y vuelve a entrar.

Desde `~/boton-lvgl`, compila el ejemplo con la biblioteca del tutorial anterior:

```bash
LVPORT="$HOME/lv_port_linux"
gcc -Wall -DLV_CONF_SKIP \
  -DLV_CONF_KCONFIG_EXTERNAL_INCLUDE="\"$LVPORT/build/lvgl/autoconf.h\"" \
  -I"$LVPORT/lvgl" -I"$LVPORT/lvgl/include" \
  -I"$LVPORT/lvgl/include/lvgl/drivers/display" \
  main.c "$LVPORT/build/lvgl/liblvgl.a" \
  -lm -lpthread -ldl -o boton-lvgl
```

`LVPORT` identifica la carpeta del port; cambia su valor si está en otra ubicación. Las opciones `-I` indican dónde buscar cabeceras y las opciones `-D` seleccionan la configuración generada al compilar LVGL. `-Wall` activa advertencias; `-lm -lpthread -ldl` enlaza bibliotecas del sistema y `-o` asigna el nombre del ejecutable. La biblioteca estática se coloca después de `main.c` para resolver sus referencias.

Si la compilación termina sin errores, inicia la aplicación:

```bash
./boton-lvgl
```

Debe aparecer un botón centrado con el texto **Button**. Tócalo y suéltalo: la terminal debe mostrar `button pressed`. Toca también fuera del botón: no debe aparecer otro mensaje. Prueba cerca de sus bordes para comprobar que la posición touch coincide con la imagen. Termina con Ctrl+C. Si cambias el código o la calibración, compila de nuevo antes de ejecutar.

<iframe
    width="600" height="338" style="width: 100%; max-width: 600px; aspect-ratio: 16 / 9; height: auto;"
    src="https://www.youtube.com/embed/SZh42cn2svY?start=1950"
    title="Configuración de botones y calibración táctil con LVGL" loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
</iframe>


## 5. Problemas frecuentes

- **El botón se ve, pero no responde:** verifica el dispositivo con `/proc/bus/input/devices`, observa eventos con `evtest` y comprueba permisos y `CONFIG_LV_USE_EVDEV=y`.
- **La pulsación está desplazada o invertida:** mide las esquinas con la orientación definitiva y revisa el intercambio de ejes y el orden espacial de los extremos.
- **La pantalla no muestra la interfaz:** comprueba el framebuffer y sus permisos; evita que otra aplicación dibuje en él simultáneamente.
- **Faltan símbolos de evdev:** configura y compila LVGL de nuevo después de activar evdev; comprueba que el programa utiliza el `autoconf.h` de esa compilación.

## Referencias

- [Ejemplo original de botón y calibración](https://github.com/zero-volts/zerovolts-ui/blob/main/examples/main_touch_calibration.c)
- [Controlador evdev de LVGL](https://docs.lvgl.io/master/details/integration/embedded_linux/drivers/evdev.html) y [declaraciones de calibración](https://github.com/lvgl/lvgl/blob/master/include/lvgl/drivers/indev/lv_evdev.h).
