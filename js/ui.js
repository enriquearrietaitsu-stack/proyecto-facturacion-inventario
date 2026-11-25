// js/ui.js

export function mostrarAlerta(mensaje, tipo = 'info') {
    // Reemplaza aquí por la alerta o mensaje visual que uses en tu app
    alert(mensaje);
}

export function limpiarCamposFactura() {
    const campos = ['cliente', 'cedula', 'telefono', 'producto', 'cantidad'];
    campos.forEach((id) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.value = '';
        }
    });
}

export function renderizarTotal(total, elementoId = 'totalPagar') {
    const etiquetaTotal = document.getElementById(elementoId);
    if (etiquetaTotal) {
        etiquetaTotal.textContent = `$${Number(total).toFixed(2)}`;
    }
}