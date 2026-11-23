// ============================================================================
// 1. INVENTARIO DE PRODUCTOS Y SERVICIOS (Equivalente a tu inventario.xlsx)
// ============================================================================
const inventario = {
    1: { nombre: "Cable UTP Cat6 (metro)", precio: 1.50, stock: 20 },
    2: { nombre: "Conector RJ45", precio: 0.50, stock: 50 },
    3: { nombre: "Limpieza de RAM", precio: 10.00, stock: 10 },
    4: { nombre: "Mantenimiento Preventivo PC", precio: 25.00, stock: 8 },
    5: { nombre: "Formateo e Instalacion OS", precio: 30.00, stock: 6 },
    6: { nombre: "Pasta Termica Premium", precio: 8.00, stock: 12 },
    7: { nombre: "Router Wi-Fi Doble Banda", precio: 45.00, stock: 5 },
    8: { nombre: "Switch 8 Puertos", precio: 22.00, stock: 7 },
    9: { nombre: "Disco SSD 480GB", precio: 38.00, stock: 9 },
    10: { nombre: "Memoria RAM DDR4 8GB", precio: 28.00, stock: 11 }
};

// Claves de persistencia en localStorage
const CLAVE_INVENTARIO = "facturacion_inventario_v1";
const CLAVE_FACTURAS = "facturacion_emitidas_v1";

// Lista (arreglo) donde se guardan los artículos de la factura actual
let carrito = [];

// REGISTRO HISTÓRICO de facturas confirmadas (mini base de datos en memoria)
let facturasEmitidas = [];

function hayStockSuficiente(codigo, cantidadExtra) {
    const productoInfo = inventario[codigo];
    if (!productoInfo) return false;
    const itemEnCarrito = carrito.find(item => item.codigo === codigo);
    const cantidadActual = itemEnCarrito ? itemEnCarrito.cantidad : 0;

    return (cantidadActual + cantidadExtra) <= productoInfo.stock;
}

// ============================================================================
// 2. PERSISTENCIA LOCAL (simulación de base de datos con localStorage)
// ============================================================================
function guardarEstadoLocal() {
    try {
        localStorage.setItem(CLAVE_INVENTARIO, JSON.stringify(inventario));
        localStorage.setItem(CLAVE_FACTURAS, JSON.stringify(facturasEmitidas));
    } catch (e) {
        // Si localStorage no está disponible, continúa funcionando en memoria
    }
}

function cargarEstadoLocal() {
    try {
        const invGuardado = localStorage.getItem(CLAVE_INVENTARIO);
        if (invGuardado) {
            const parsedInv = JSON.parse(invGuardado);
            if (parsedInv && typeof parsedInv === "object") {
                for (const clave in inventario) {
                    delete inventario[clave];
                }
                Object.assign(inventario, parsedInv);
            }
        }

        const facGuardadas = localStorage.getItem(CLAVE_FACTURAS);
        if (facGuardadas) {
            const parsedFac = JSON.parse(facGuardadas);
            if (Array.isArray(parsedFac)) {
                facturasEmitidas = parsedFac;
            }
        }
    } catch (e) {
        // Si hay datos corruptos, conserva los valores por defecto del código
    }
}

// ============================================================================
// 3. CARGA INICIAL DEL MENÚ DESPLEGABLE Y EVENTOS DE BOTONES
// ============================================================================
const listaProductos = document.getElementById("lista_productos");

function actualizarListaProductos() {
    if (!listaProductos) return;
    listaProductos.innerHTML = "";

    for (const codigo in inventario) {
        const item = inventario[codigo];
        const opcion = document.createElement("option");
        opcion.value = `[${codigo}] ${item.nombre}`;
        opcion.label = `$${item.precio.toFixed(2)} | Stock: ${item.stock}`;
        listaProductos.appendChild(opcion);
    }
}

function resolverCodigoProducto(textoIngresado) {
    const limpio = String(textoIngresado || "").trim();
    if (!limpio) return null;

    // 1. Coincidencia exacta por clave de inventario
    if (inventario[limpio]) {
        return limpio;
    }

    // 2. Extraer código entre corchetes, ej. "[1] Cable UTP Cat6 (metro)" -> "1"
    const matchCorchetes = limpio.match(/^\[([^\]]+)\]/);
    if (matchCorchetes) {
        const codExtraido = matchCorchetes[1].trim();
        if (inventario[codExtraido]) return codExtraido;

        // Buscar clave numérica equivalente (ej. "1" coincide con "01")
        for (const codigo in inventario) {
            if (String(Number(codigo)) === String(Number(codExtraido)) && !isNaN(Number(codExtraido))) {
                return codigo;
            }
        }
    }

    // 3. Coincidencia exacta por nombre (sin importar mayúsculas)
    const lower = limpio.toLowerCase();
    for (const codigo in inventario) {
        if (String(inventario[codigo].nombre).toLowerCase() === lower) {
            return codigo;
        }
    }

    // 4. Si el texto coincide con "[código] nombre" pero con nombre ligeramente distinto, usar el código si existe
    if (matchCorchetes) {
        const codExtraido = matchCorchetes[1].trim();
        for (const codigo in inventario) {
            if (codigo.toLowerCase() === codExtraido.toLowerCase()) {
                return codigo;
            }
        }
    }

    return null;
}

// Muestra un mensaje de estado en la zona de botones (sin alertas intrusivas)
function mostrarMensajeEstado(texto) {
    const zona = document.getElementById("estado-carrito");
    if (!zona) return;
    zona.innerText = texto;
    // El mensaje se desvanece después de 6 segundos
    setTimeout(() => {
        if (zona.innerText === texto) zona.innerText = "";
    }, 6000);
}

// Establece la fecha de hoy en el campo fecha (si está vacío)
function establecerFechaHoy() {
    const campoFecha = document.getElementById("fecha");
    if (!campoFecha) return;
    const hoy = new Date();
    const fechaLocal = hoy.getFullYear() + "-"
        + String(hoy.getMonth() + 1).padStart(2, "0") + "-"
        + String(hoy.getDate()).padStart(2, "0");
    campoFecha.value = fechaLocal;
}

// ★★★ CORRECCIÓN 1: Cargar SIEMPRE el estado guardado ANTES de pintar el menú.
// Antes cargarEstadoLocal() existía pero jamás se invocaba al iniciar,
// por eso los productos nuevos desaparecían al recargar la pestaña.
cargarEstadoLocal();
actualizarListaProductos();
establecerFechaHoy();

// Vinculamos los botones principales con sus funciones
document.getElementById("btnAgregar").addEventListener("click", agregarProducto);
document.getElementById("btnImprimir").addEventListener("click", () => window.print());
document.getElementById("btnLimpiar").addEventListener("click", limpiarFactura);

// ============================================================================
// 4. FUNCIONES DE LÓGICA DE FACTURACIÓN
// ============================================================================

/**
 * Agrega un producto al carrito.
 * Si el producto ya existe en la lista, suma la cantidad a la fila existente
 * en lugar de crear una fila duplicada.
 */
function agregarProducto() {
    const inputBuscar = document.getElementById("buscar_producto");
    const inputCantidad = document.getElementById("cantidad");

    const textoProducto = inputBuscar ? inputBuscar.value : "";
    const codigo = resolverCodigoProducto(textoProducto);
    const cantidad = parseInt(inputCantidad ? inputCantidad.value : "1", 10);

    if (!codigo) {
        // Validación en silencio: devolvemos el foco al buscador sin bloquear
        if (inputBuscar) inputBuscar.focus();
        return;
    }

    // Validamos que la cantidad sea un número válido y mayor a 0
    if (isNaN(cantidad) || cantidad <= 0) {
        mostrarMensajeEstado("⚠️ La cantidad debe ser mayor a cero.");
        return;
    }

    if (!hayStockSuficiente(codigo, cantidad)) {
        mostrarMensajeEstado(`⚠️ Stock insuficiente para "${inventario[codigo].nombre}". Disponible: ${inventario[codigo].stock}.`);
        return;
    }

    const productoInfo = inventario[codigo];

    // Buscamos si el producto ya está en el carrito por su código
    const itemExistente = carrito.find(item => item.codigo === codigo);

    if (itemExistente) {
        // Ya existe: acumulamos cantidad y recalculamos el subtotal de esa fila
        itemExistente.cantidad += cantidad;
        itemExistente.subtotal = itemExistente.precio * itemExistente.cantidad;
    } else {
        // No existe: agregamos un nuevo objeto al arreglo 'carrito'
        carrito.push({
            codigo: codigo,
            nombre: productoInfo.nombre,
            precio: productoInfo.precio,
            cantidad: cantidad,
            subtotal: productoInfo.precio * cantidad
        });
    }

    renderizarCarrito();
    if (inputBuscar) inputBuscar.value = "";
    if (inputCantidad) inputCantidad.value = "1";
}

/**
 * Suma 1 unidad a un producto ya presente en el carrito y actualiza su subtotal.
 * @param {number} indice - Posición del producto en 'carrito'.
 */
function sumarUnidad(indice) {
    const codigo = carrito[indice].codigo;

    if (!hayStockSuficiente(codigo, 1)) {
        mostrarMensajeEstado("⚠️ No hay suficiente en stock.");
        return;
    }

    carrito[indice].cantidad += 1;
    carrito[indice].subtotal = carrito[indice].precio * carrito[indice].cantidad;
    renderizarCarrito();
}

/**
 * Resta 1 unidad a un producto en el carrito.
 * Si tiene más de 1 unidad, solo resta 1.
 * Si solo tenía 1 unidad, elimina la fila completa porque llegaría a 0.
 * @param {number} indice - Posición del producto en 'carrito'.
 */
function restarUnidad(indice) {
    if (carrito[indice].cantidad > 1) {
        carrito[indice].cantidad -= 1;
        carrito[indice].subtotal = carrito[indice].precio * carrito[indice].cantidad;
    } else {
        carrito.splice(indice, 1);
    }
    renderizarCarrito();
}

/**
 * Elimina por completo la fila del producto indicado de la factura.
 * @param {number} indice - Posición del producto en 'carrito'.
 */
function eliminarProducto(indice) {
    carrito.splice(indice, 1);
    renderizarCarrito();
}

/**
 * Redibuja toda la tabla HTML con los datos actuales de 'carrito'
 * y calcula el total general de la factura.
 */
function renderizarCarrito() {
    const tabla = document.getElementById("lista_carrito");
    if (!tabla) return;
    tabla.innerHTML = ""; // Limpiamos la tabla antes de volver a pintarla
    let totalGeneral = 0;

    for (let i = 0; i < carrito.length; i++) {
        const item = carrito[i];
        totalGeneral += item.subtotal;

        // Generamos la fila con botones para restar 1, sumar 1 o eliminar toda la fila
        tabla.innerHTML += `
            <tr>
                <td>${item.codigo}</td>
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>$${item.subtotal.toFixed(2)}</td>
                <td class="no-imprimir">
                    <button type="button" class="btn-cantidad" onclick="restarUnidad(${i})" title="Restar 1 unidad">➖</button>
                    <button type="button" class="btn-cantidad" onclick="sumarUnidad(${i})" title="Sumar 1 unidad">➕</button>
                    <button type="button" class="btn-eliminar-fila" onclick="eliminarProducto(${i})" title="Eliminar toda la fila">❌</button>
                </td>
            </tr>
        `;
    }

    document.getElementById("total").innerText = totalGeneral.toFixed(2);
}

/**
 * Vacía el carrito, limpia TODOS los campos de cabecera y reinicia el total.
 * ★★★ CORRECCIÓN 2: ahora también limpia CI, teléfono y fecha (antes quedaban
 * con datos del cliente anterior).
 */
function limpiarFactura() {
    carrito = [];
    renderizarCarrito();
    document.getElementById("cliente").value = "";
    document.getElementById("ci_cliente").value = "";
    document.getElementById("telefono_cliente").value = "";
    document.getElementById("num_factura").value = "001";
    establecerFechaHoy();
    const zona = document.getElementById("estado-carrito");
    if (zona) zona.innerText = "";
}

// ============================================================================
// 5. CONFIRMACIÓN DE FACTURA Y ACTUALIZACIÓN DE STOCK
// ============================================================================

/**
 * Confirma la factura: descuenta stock, guarda la factura en el registro
 * histórico, persiste en localStorage y reinicia el formulario completo.
 */
function confirmarFactura() {
    if (carrito.length === 0) {
        mostrarMensajeEstado("⚠️ Agrega al menos un producto antes de confirmar la factura.");
        return;
    }

    const cliente = document.getElementById("cliente").value.trim();
    const ciCliente = document.getElementById("ci_cliente").value.trim();
    const telefonoCliente = document.getElementById("telefono_cliente").value.trim();

    if (!cliente || !ciCliente || !telefonoCliente) {
        mostrarMensajeEstado("⚠️ Completa Nombre, CI/Cédula y Teléfono del cliente antes de confirmar.");
        return;
    }

    // Validación final de stock (por si el inventario cambió mientras se armaba la factura)
    for (const item of carrito) {
        if (item.cantidad > inventario[item.codigo].stock) {
            mostrarMensajeEstado(`⚠️ Stock insuficiente para "${item.nombre}". Disponible: ${inventario[item.codigo].stock}.`);
            return;
        }
    }

    // Descontamos stock y calculamos el total
    let totalFactura = 0;
    for (const item of carrito) {
        inventario[item.codigo].stock -= item.cantidad;
        totalFactura += item.subtotal;
    }

    const numeroFactura = document.getElementById("num_factura").value.trim() || "001";

    facturasEmitidas.push({
        numero: numeroFactura,
        fecha: document.getElementById("fecha").value,
        cliente: {
            nombre: cliente,
            ci: ciCliente,
            telefono: telefonoCliente
        },
        items: [...carrito],
        total: totalFactura
    });

    guardarEstadoLocal();

    // Vaciamos el carrito y refrescamos las vistas
    carrito = [];
    renderizarCarrito();
    renderizarInventario();
    actualizarListaProductos();

    // ★★★ CORRECCIÓN 3: mensaje de "factura cargada" + reinicio completo del
    // formulario (antes el alert() quedó FUERA de la función como código suelto
    // y se disparaba al cargar la página, y los datos del cliente no se limpiaban).
    mostrarMensajeEstado(`✅ Factura N.º ${numeroFactura} cargada por $${totalFactura.toFixed(2)}. Stock actualizado.`);

    document.getElementById("cliente").value = "";
    document.getElementById("ci_cliente").value = "";
    document.getElementById("telefono_cliente").value = "";

    // Numeración automática: incrementamos el número de factura
    const siguiente = parseInt(numeroFactura, 10);
    document.getElementById("num_factura").value = isNaN(siguiente)
        ? numeroFactura
        : String(siguiente + 1).padStart(3, "0");
    establecerFechaHoy();
}

// ============================================================================
// 6. NAVEGACIÓN ENTRE VISTAS Y MÓDULO DE INVENTARIO
// ============================================================================

// En app.js: reemplaza cambiarVista y agrega renderizarVentas
function cambiarVista(vista) {
    const secFacturacion = document.getElementById("vista-facturacion");
    const secInventario = document.getElementById("vista-inventario");
    const secVentas = document.getElementById("vista-ventas");

    const btnFacturacion = document.getElementById("nav-facturacion");
    const btnInventario = document.getElementById("nav-inventario");
    const btnVentas = document.getElementById("nav-ventas");

    secFacturacion?.classList.add("oculto");
    secInventario?.classList.add("oculto");
    secVentas?.classList.add("oculto");

    btnFacturacion?.classList.remove("activo");
    btnInventario?.classList.remove("activo");
    btnVentas?.classList.remove("activo");

    if (vista === "inventario") {
        secInventario?.classList.remove("oculto");
        btnInventario?.classList.add("activo");
        renderizarInventario();
    } else if (vista === "ventas") {
        secVentas?.classList.remove("oculto");
        btnVentas?.classList.add("activo");
        renderizarVentas();
    } else {
        secFacturacion?.classList.remove("oculto");
        btnFacturacion?.classList.add("activo");
    }
}

function renderizarVentas() {
    const cuerpoVentas = document.getElementById("lista_ventas");
    const spanTotalVentas = document.getElementById("total-ventas");
    if (!cuerpoVentas) return;

    cuerpoVentas.innerHTML = "";
    let totalAcumulado = 0;

    if (!Array.isArray(facturasEmitidas) || facturasEmitidas.length === 0) {
        cuerpoVentas.innerHTML = `
            <tr>
                <td colspan="6">Aún no hay facturas confirmadas registradas.</td>
            </tr>
        `;
        if (spanTotalVentas) spanTotalVentas.innerText = "0.00";
        return;
    }

    for (const factura of facturasEmitidas) {
        const totalFactura = Number(factura.total) || 0;
        totalAcumulado += totalFactura;

        const detalleItems = Array.isArray(factura.items)
            ? factura.items.map(item => `${item.nombre} (x${item.cantidad})`).join(", ")
            : "";

        const contacto = [factura.cliente?.ci, factura.cliente?.telefono]
            .filter(Boolean)
            .join(" / ");

        cuerpoVentas.innerHTML += `
            <tr>
                <td>${factura.numero || "-"}</td>
                <td>${factura.fecha || "-"}</td>
                <td>${factura.cliente?.nombre || "-"}</td>
                <td>${contacto || "-"}</td>
                <td>${detalleItems || "-"}</td>
                <td>$${totalFactura.toFixed(2)}</td>
            </tr>
        `;
    }

    if (spanTotalVentas) {
        spanTotalVentas.innerText = totalAcumulado.toFixed(2);
    }
}
function renderizarInventario() {
    const cuerpoInventario = document.getElementById("lista_inventario");
    if (!cuerpoInventario) return;

    cuerpoInventario.innerHTML = "";

    for (const codigo in inventario) {
        const item = inventario[codigo];
        const estado = item.stock > 0 ? "Disponible" : "Agotado";

        // ★★★ CORRECCIÓN 4: botón ❌ para eliminar productos del inventario
        cuerpoInventario.innerHTML += `
            <tr>
                <td>${codigo}</td>
                <td>${item.nombre}</td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>${item.stock}</td>
                <td>${estado}</td>
                <td class="no-imprimir">
                    <button type="button" class="btn-eliminar-fila" onclick="eliminarProductoInventario('${codigo}')" title="Eliminar producto del inventario">❌</button>
                </td>
            </tr>
        `;
    }
}

/**
 * Elimina un producto del inventario tras pedir confirmación.
 * @param {string} codigo - Clave del producto en 'inventario'.
 */
function eliminarProductoInventario(codigo) {
    const item = inventario[codigo];
    if (!item) return;

    const confirmado = confirm(`¿Seguro que deseas eliminar "${item.nombre}" del inventario?`);
    if (!confirmado) return;

    delete inventario[codigo];
    guardarEstadoLocal();
    renderizarInventario();
    actualizarListaProductos();
}

function alternarFormularioProducto(forzarEstado) {
    const form = document.getElementById("form-nuevo-producto");
    if (!form) return;

    if (typeof forzarEstado === "boolean") {
        form.classList.toggle("oculto", !forzarEstado);
    } else {
        form.classList.toggle("oculto");
    }

    if (!form.classList.contains("oculto")) {
        document.getElementById("nuevo_codigo")?.focus();
    }
}

function guardarNuevoProducto() {
    const inputCodigo = document.getElementById("nuevo_codigo");
    const inputNombre = document.getElementById("nuevo_nombre");
    const inputPrecio = document.getElementById("nuevo_precio");
    const inputStock = document.getElementById("nuevo_stock");

    const codigo = (inputCodigo?.value || "").trim();
    const nombre = (inputNombre?.value || "").trim();
    const precio = parseFloat(inputPrecio?.value);
    const stock = parseInt(inputStock?.value, 10);

    if (!codigo || !nombre) {
        alert("⚠️ Completa el código y el nombre del producto.");
        return;
    }

    if (inventario[codigo]) {
        alert(`⚠️ Ya existe un producto con el código "${codigo}". Usa otro código.`);
        return;
    }

    if (isNaN(precio) || precio < 0) {
        alert("⚠️ Ingresa un precio válido (0 o mayor).");
        return;
    }

    if (isNaN(stock) || stock < 0) {
        alert("⚠️ Ingresa un stock inicial válido (0 o mayor).");
        return;
    }

    inventario[codigo] = { nombre, precio, stock };
    guardarEstadoLocal();

    if (inputCodigo) inputCodigo.value = "";
    if (inputNombre) inputNombre.value = "";
    if (inputPrecio) inputPrecio.value = "";
    if (inputStock) inputStock.value = "1";

    actualizarListaProductos();
    renderizarInventario();
    alternarFormularioProducto(false);

    alert(`✅ Producto "${nombre}" agregado al inventario.`);
}

/**
 * Muestra u oculta el formulario de reducción de stock.
 * Al abrir uno de los dos formularios del inventario, el otro se cierra.
 */
function alternarFormularioReduccion(forzarEstado) {
    const formReducir = document.getElementById("form-reducir-stock");
    const formNuevo = document.getElementById("form-nuevo-producto");
    if (!formReducir) return;

    if (typeof forzarEstado === "boolean") {
        formReducir.classList.toggle("oculto", !forzarEstado);
    } else {
        formReducir.classList.toggle("oculto");
    }

    if (!formReducir.classList.contains("oculto")) {
        // Evita tener ambos formularios abiertos a la vez
        if (formNuevo) formNuevo.classList.add("oculto");
        document.getElementById("reducir_producto")?.focus();
    }
}

/**
 * Descuenta una cantidad del stock de un producto existente (salida de
 * inventario por daño, pérdida, uso interno, etc.).
 * El producto NO se elimina; solo se reduce su stock, sin bajar de 0.
 */
function guardarReduccionStock() {
    const inputProducto = document.getElementById("reducir_producto");
    const inputCantidad = document.getElementById("reducir_cantidad");
    const inputMotivo = document.getElementById("reducir_motivo");

    const codigo = resolverCodigoProducto(inputProducto?.value);
    const cantidad = parseInt(inputCantidad?.value, 10);
    const motivo = (inputMotivo?.value || "").trim();

    if (!codigo) {
        alert("⚠️ Producto no encontrado. Escribe un código o nombre válido.");
        if (inputProducto) inputProducto.focus();
        return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        alert("⚠️ La cantidad a descontar debe ser mayor a cero.");
        return;
    }

    const producto = inventario[codigo];

    if (cantidad > producto.stock) {
        alert(`⚠️ No puedes descontar ${cantidad} unidad(es). Stock actual de "${producto.nombre}": ${producto.stock}.`);
        return;
    }

    producto.stock -= cantidad;
    guardarEstadoLocal();

    if (inputProducto) inputProducto.value = "";
    if (inputCantidad) inputCantidad.value = "1";
    if (inputMotivo) inputMotivo.value = "";

    renderizarInventario();
    actualizarListaProductos();
    alternarFormularioReduccion(false);

    const detalleMotivo = motivo ? ` (Motivo: ${motivo})` : "";
    alert(`✅ Se descontaron ${cantidad} unidad(es) de "${producto.nombre}". Stock restante: ${producto.stock}${detalleMotivo}.`);
}

// ============================================================================
// 7. PROTECCIÓN CONTRA CIERRE ACCIDENTAL CON DATOS SIN GUARDAR
// ============================================================================
window.addEventListener("beforeunload", function (event) {
    const clienteEscrito = document.getElementById("cliente")?.value.trim() !== "";
    const ciEscrito = document.getElementById("ci_cliente")?.value.trim() !== "";
    const telEscrito = document.getElementById("telefono_cliente")?.value.trim() !== "";
    const hayDatosActivos =
        carrito.length > 0 ||
        facturasEmitidas.length > 0 ||
        clienteEscrito ||
        ciEscrito ||
        telEscrito;

    if (hayDatosActivos) {
        event.preventDefault();
        event.returnValue = "";
    }
});