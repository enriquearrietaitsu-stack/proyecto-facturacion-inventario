// js/storage.js

export const CLAVES_STORAGE = {
    INVENTARIO: 'inventario',
    CARRITO: 'carrito',
    FACTURAS: 'facturasEmitidas'
};

export function guardarDatos(clave, datos) {
    localStorage.setItem(clave, JSON.stringify(datos));
}

export function cargarDatos(clave, valorPorDefecto = []) {
    const datosGuardados = localStorage.getItem(clave);
    return datosGuardados ? JSON.parse(datosGuardados) : valorPorDefecto;
}

export function eliminarDatos(clave) {
    localStorage.removeItem(clave);
}