import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Plus, Trash2, DollarSign, FileText, Download, Check, X, Edit2, Inbox, ArrowRight } from 'lucide-react';

export default function GestorGastosCliente() {
  const [clientes, setClientes] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [bandejaEntrada, setBandejaEntrada] = useState([]);
  const [clienteActual, setClienteActual] = useState('');
  const [proyectoActual, setProyectoActual] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [mostrarBandeja, setMostrarBandeja] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', email: '', telefono: '' });
  const fileInputRef = useRef(null);
  const inboxInputRef = useRef(null);

  // Cargar datos del localStorage
  useEffect(() => {
    const datosGuardados = localStorage.getItem('gestorGastos');
    if (datosGuardados) {
      const datos = JSON.parse(datosGuardados);
      setClientes(datos.clientes || []);
      setFacturas(datos.facturas || []);
      setBandejaEntrada(datos.bandejaEntrada || []);
    }
  }, []);

  // Guardar datos en localStorage
  useEffect(() => {
    localStorage.setItem('gestorGastos', JSON.stringify({
      clientes,
      facturas,
      bandejaEntrada
    }));
  }, [clientes, facturas, bandejaEntrada]);

  // Agregar nuevo cliente
  const agregarCliente = () => {
    if (nuevoCliente.nombre.trim()) {
      setClientes([...clientes, { ...nuevoCliente, id: Date.now() }]);
      setNuevoCliente({ nombre: '', email: '', telefono: '' });
      setShowAddClient(false);
    }
  };

  // Procesar imagen o PDF de factura con Claude
  const procesarFactura = async (file, destino = 'asignada') => {
    setIsProcessing(true);
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("Error al leer archivo"));
        reader.readAsDataURL(file);
      });

      const isPDF = file.type === 'application/pdf';
      
      const content = isPDF ? [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Data,
          }
        },
        {
          type: "text",
          text: `Analiza esta factura PDF y extrae la siguiente información en formato JSON. Responde SOLO con el JSON, sin texto adicional:

{
  "tienda": "nombre de la tienda",
  "fecha": "YYYY-MM-DD",
  "total": número sin símbolos,
  "items": ["item 1", "item 2", "item 3"],
  "numeroFactura": "número de factura si está visible"
}

Si no puedes encontrar algún dato, usa null. Para items, lista los productos principales que puedas identificar.`
        }
      ] : [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: file.type,
            data: base64Data,
          }
        },
        {
          type: "text",
          text: `Analiza esta factura y extrae la siguiente información en formato JSON. Responde SOLO con el JSON, sin texto adicional:

{
  "tienda": "nombre de la tienda",
  "fecha": "YYYY-MM-DD",
  "total": número sin símbolos,
  "items": ["item 1", "item 2", "item 3"],
  "numeroFactura": "número de factura si está visible"
}

Si no puedes encontrar algún dato, usa null. Para items, lista los productos principales que puedas identificar.`
        }
      ];

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: content
            }
          ]
        })
      });

      const data = await response.json();
      let responseText = data.content[0].text;
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const facturaData = JSON.parse(responseText);

      const nuevaFactura = {
        id: Date.now(),
        ...facturaData,
        pagada: false,
        notas: '',
        categoria: '',
        archivoUrl: URL.createObjectURL(file),
        nombreArchivo: file.name,
        tipoArchivo: file.type
      };

      if (destino === 'bandeja') {
        setBandejaEntrada([...bandejaEntrada, nuevaFactura]);
      } else {
        const facturaConCliente = {
          ...nuevaFactura,
          cliente: clienteActual,
          proyecto: proyectoActual,
        };
        setFacturas([...facturas, facturaConCliente]);
      }
    } catch (error) {
      console.error("Error procesando factura:", error);
      alert("Error al procesar la factura. Por favor, intenta de nuevo o ingresa los datos manualmente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        procesarFactura(file, 'asignada');
      });
    }
  };

  const handleInboxUpload = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        procesarFactura(file, 'bandeja');
      });
    }
  };

  // Asignar factura de bandeja a cliente
  const asignarFacturaBandeja = (facturaId, clienteId, proyecto) => {
    const factura = bandejaEntrada.find(f => f.id === facturaId);
    if (factura) {
      const facturaAsignada = {
        ...factura,
        cliente: clienteId,
        proyecto: proyecto
      };
      setFacturas([...facturas, facturaAsignada]);
      setBandejaEntrada(bandejaEntrada.filter(f => f.id !== facturaId));
    }
  };

  // Eliminar de bandeja
  const eliminarDeBandeja = (id) => {
    if (confirm('¿Eliminar esta factura de la bandeja?')) {
      setBandejaEntrada(bandejaEntrada.filter(f => f.id !== id));
    }
  };

  // Agregar factura manual
  const agregarFacturaManual = () => {
    const nuevaFactura = {
      id: Date.now(),
      cliente: clienteActual,
      proyecto: proyectoActual,
      tienda: '',
      fecha: new Date().toISOString().split('T')[0],
      total: 0,
      items: [],
      numeroFactura: '',
      pagada: false,
      notas: '',
      categoria: ''
    };
    setFacturas([...facturas, nuevaFactura]);
  };

  // Actualizar factura
  const actualizarFactura = (id, campo, valor) => {
    setFacturas(facturas.map(f => 
      f.id === id ? { ...f, [campo]: valor } : f
    ));
  };

  // Eliminar factura
  const eliminarFactura = (id) => {
    if (confirm('¿Eliminar esta factura?')) {
      setFacturas(facturas.filter(f => f.id !== id));
    }
  };

  // Generar reporte PDF
  const generarReportePDF = () => {
    const facturasCliente = facturas.filter(f => 
      f.cliente === clienteActual && 
      (!proyectoActual || f.proyecto === proyectoActual)
    );

    const facturasPendientes = facturasCliente.filter(f => !f.pagada);
    const totalPendiente = facturasPendientes.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
    const totalPagado = facturasCliente.filter(f => f.pagada).reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
    const totalGeneral = facturasCliente.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);

    const cliente = clientes.find(c => c.id === parseInt(clienteActual));

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: Arial, sans-serif; 
      padding: 40px; 
      color: #333;
    }
    .header { 
      border-bottom: 3px solid #2563eb; 
      padding-bottom: 20px; 
      margin-bottom: 30px;
    }
    .header h1 { 
      color: #2563eb; 
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .info-cliente {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
    }
    .info-cliente h3 {
      margin: 0 0 10px 0;
      color: #1f2937;
    }
    .resumen { 
      background: #fef3c7; 
      padding: 20px; 
      border-radius: 8px; 
      margin-bottom: 30px;
      border-left: 4px solid #f59e0b;
    }
    .resumen h2 { 
      margin: 0 0 15px 0; 
      color: #92400e;
      font-size: 20px;
    }
    .resumen-item { 
      display: flex; 
      justify-content: space-between; 
      margin: 8px 0;
      font-size: 16px;
    }
    .total-pendiente { 
      font-size: 24px; 
      font-weight: bold; 
      color: #dc2626;
      border-top: 2px solid #92400e;
      padding-top: 12px;
      margin-top: 12px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th { 
      background: #2563eb; 
      color: white; 
      padding: 12px; 
      text-align: left;
      font-weight: 600;
    }
    td { 
      padding: 12px; 
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover { 
      background: #f9fafb; 
    }
    .pagada { 
      color: #059669; 
      font-weight: bold;
    }
    .pendiente { 
      color: #dc2626; 
      font-weight: bold;
    }
    .items-list {
      font-size: 13px;
      color: #6b7280;
      margin: 5px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Reporte de Gastos - Servicios de Remodelación</h1>
    <p style="margin: 5px 0; color: #6b7280;">Fecha del reporte: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
  
  ${cliente ? `
  <div class="info-cliente">
    <h3>Cliente</h3>
    <p style="margin: 5px 0;"><strong>${cliente.nombre}</strong></p>
    ${cliente.email ? `<p style="margin: 5px 0;">Email: ${cliente.email}</p>` : ''}
    ${cliente.telefono ? `<p style="margin: 5px 0;">Teléfono: ${cliente.telefono}</p>` : ''}
    ${proyectoActual ? `<p style="margin: 5px 0;">Proyecto: <strong>${proyectoActual}</strong></p>` : ''}
  </div>
  ` : ''}
  
  <div class="resumen">
    <h2>Resumen de Gastos</h2>
    <div class="resumen-item">
      <span>Total Pagado:</span>
      <span style="color: #059669; font-weight: 600;">$${totalPagado.toFixed(2)}</span>
    </div>
    <div class="resumen-item">
      <span>Total Pendiente:</span>
      <span style="color: #dc2626; font-weight: 600;">$${totalPendiente.toFixed(2)}</span>
    </div>
    <div class="resumen-item total-pendiente">
      <span>TOTAL GENERAL:</span>
      <span>$${totalGeneral.toFixed(2)}</span>
    </div>
  </div>

  <h2 style="color: #1f2937; margin-bottom: 15px;">Detalle de Facturas Pendientes</h2>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Tienda</th>
        <th>Items</th>
        <th>Categoría</th>
        <th>Monto</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${facturasPendientes.map(f => `
        <tr>
          <td>${new Date(f.fecha).toLocaleDateString('es-ES')}</td>
          <td><strong>${f.tienda}</strong>${f.numeroFactura ? `<br><small>#${f.numeroFactura}</small>` : ''}</td>
          <td>
            ${f.items && f.items.length > 0 ? `<div class="items-list">${f.items.join(', ')}</div>` : ''}
            ${f.notas ? `<div style="margin-top: 5px; font-style: italic;">${f.notas}</div>` : ''}
          </td>
          <td>${f.categoria || '-'}</td>
          <td style="font-weight: 600;">$${parseFloat(f.total || 0).toFixed(2)}</td>
          <td class="pendiente">PENDIENTE</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${facturasCliente.filter(f => f.pagada).length > 0 ? `
    <h2 style="color: #1f2937; margin-top: 40px; margin-bottom: 15px;">Facturas Pagadas</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tienda</th>
          <th>Items</th>
          <th>Categoría</th>
          <th>Monto</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${facturasCliente.filter(f => f.pagada).map(f => `
          <tr>
            <td>${new Date(f.fecha).toLocaleDateString('es-ES')}</td>
            <td><strong>${f.tienda}</strong>${f.numeroFactura ? `<br><small>#${f.numeroFactura}</small>` : ''}</td>
            <td>
              ${f.items && f.items.length > 0 ? `<div class="items-list">${f.items.join(', ')}</div>` : ''}
              ${f.notas ? `<div style="margin-top: 5px; font-style: italic;">${f.notas}</div>` : ''}
            </td>
            <td>${f.categoria || '-'}</td>
            <td style="font-weight: 600;">$${parseFloat(f.total || 0).toFixed(2)}</td>
            <td class="pagada">PAGADA</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <div class="footer">
    <p>Este reporte fue generado automáticamente.</p>
    <p>Para cualquier consulta o aclaración, por favor contacte a su proveedor de servicios.</p>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_${cliente?.nombre || 'Cliente'}_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    
    alert('Reporte generado. Puedes abrirlo en tu navegador y guardarlo como PDF usando la función "Imprimir" > "Guardar como PDF"');
  };

  const facturasCliente = facturas.filter(f => 
    f.cliente === clienteActual && 
    (!proyectoActual || f.proyecto === proyectoActual)
  );

  const totalPendiente = facturasCliente.filter(f => !f.pagada).reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
            <DollarSign className="text-blue-600" size={36} />
            Gestor de Gastos - Remodelación
          </h1>
          <p className="text-gray-600">Sistema de seguimiento de compras y reembolsos para clientes</p>
          <p className="text-sm text-gray-500 mt-2">✨ Soporta imágenes y PDFs</p>
          
          {/* Botón Bandeja de Entrada */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setMostrarBandeja(!mostrarBandeja)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <Inbox size={20} />
              Bandeja de Entrada
              {bandejaEntrada.length > 0 && (
                <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs font-bold">
                  {bandejaEntrada.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => inboxInputRef.current?.click()}
              disabled={isProcessing}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:bg-gray-400"
            >
              <Upload size={20} />
              {isProcessing ? 'Procesando...' : 'Subir a Bandeja'}
            </button>

            <input
              ref={inboxInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleInboxUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Bandeja de Entrada */}
        {mostrarBandeja && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-indigo-500">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
              <Inbox />
              Bandeja de Entrada - Facturas Sin Clasificar
            </h2>
            
            {bandejaEntrada.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay facturas en la bandeja de entrada</p>
            ) : (
              <div className="space-y-4">
                {bandejaEntrada.map(factura => (
                  <div key={factura.id} className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Tienda: <span className="font-normal">{factura.tienda || 'N/A'}</span></p>
                        <p className="text-sm font-semibold text-gray-700">Fecha: <span className="font-normal">{factura.fecha || 'N/A'}</span></p>
                        <p className="text-sm font-semibold text-gray-700">Total: <span className="font-normal text-green-600">${parseFloat(factura.total || 0).toFixed(2)}</span></p>
                        {factura.items && factura.items.length > 0 && (
                          <p className="text-xs text-gray-600 mt-2">Items: {factura.items.join(', ')}</p>
                        )}
                      </div>
                      
                      <div>
                        {factura.tipoArchivo?.includes('pdf') ? (
                          <div className="flex items-center gap-2 text-red-600">
                            <FileText size={40} />
                            <span className="text-sm">PDF: {factura.nombreArchivo}</span>
                          </div>
                        ) : (
                          <img src={factura.archivoUrl} alt="Factura" className="max-w-full h-32 object-cover rounded" />
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-600">Asignar a Cliente:</label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const proyecto = prompt('Nombre del proyecto (opcional):');
                              asignarFacturaBandeja(factura.id, e.target.value, proyecto || '');
                            }
                          }}
                          className="w-full p-2 border rounded mt-1"
                          defaultValue=""
                        >
                          <option value="">Seleccionar cliente...</option>
                          {clientes.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                      
                      <button
                        onClick={() => eliminarDeBandeja(factura.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center gap-2"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sección de Cliente */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Información del Cliente</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
              <select
                value={clienteActual}
                onChange={(e) => setClienteActual(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Proyecto (opcional)</label>
              <input
                type="text"
                value={proyectoActual}
                onChange={(e) => setProyectoActual(e.target.value)}
                placeholder="Ej: Cocina, Baño, etc."
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={() => setShowAddClient(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <Plus size={20} />
            Agregar Nuevo Cliente
          </button>

          {showAddClient && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold mb-3">Nuevo Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Nombre *"
                  value={nuevoCliente.nombre}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, nombre: e.target.value})}
                  className="p-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={nuevoCliente.email}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, email: e.target.value})}
                  className="p-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="tel"
                  placeholder="Teléfono"
                  value={nuevoCliente.telefono}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                  className="p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={agregarCliente}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setShowAddClient(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sección de Agregar Facturas */}
        {clienteActual && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Agregar Facturas</h2>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:bg-gray-400"
              >
                <Upload size={20} />
                {isProcessing ? 'Procesando...' : 'Subir Foto de Factura'}
              </button>
              
              <button
                onClick={agregarFacturaManual}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
              >
                <Edit2 size={20} />
                Ingresar Manual
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {isProcessing && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 flex items-center gap-2">
                  <span className="animate-spin">⚙️</span>
                  Procesando factura con IA...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Resumen */}
        {clienteActual && facturasCliente.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow-md p-6 mb-6 border-l-4 border-orange-500">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Resumen</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-gray-600 text-sm">Total de Facturas</p>
                <p className="text-2xl font-bold text-gray-800">{facturasCliente.length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-gray-600 text-sm">Facturas Pendientes</p>
                <p className="text-2xl font-bold text-red-600">{facturasCliente.filter(f => !f.pagada).length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-gray-600 text-sm">Total Pendiente</p>
                <p className="text-3xl font-bold text-red-600">${totalPendiente.toFixed(2)}</p>
              </div>
            </div>

            <button
              onClick={generarReportePDF}
              className="mt-4 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition flex items-center gap-2 w-full md:w-auto justify-center"
            >
              <Download size={20} />
              Generar Reporte para Cobro
            </button>
          </div>
        )}

        {/* Lista de Facturas */}
        {clienteActual && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Facturas Registradas</h2>
            
            {facturasCliente.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay facturas registradas para este cliente</p>
            ) : (
              <div className="space-y-4">
                {facturasCliente.map(factura => (
                  <div key={factura.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs text-gray-500">Tienda</label>
                        <input
                          type="text"
                          value={factura.tienda}
                          onChange={(e) => actualizarFactura(factura.id, 'tienda', e.target.value)}
                          className="w-full p-2 border rounded mt-1"
                          placeholder="Ej: Home Depot"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-500">Fecha</label>
                        <input
                          type="date"
                          value={factura.fecha}
                          onChange={(e) => actualizarFactura(factura.id, 'fecha', e.target.value)}
                          className="w-full p-2 border rounded mt-1"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-500">Total ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={factura.total}
                          onChange={(e) => actualizarFactura(factura.id, 'total', e.target.value)}
                          className="w-full p-2 border rounded mt-1"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-500">Categoría</label>
                        <input
                          type="text"
                          value={factura.categoria}
                          onChange={(e) => actualizarFactura(factura.id, 'categoria', e.target.value)}
                          className="w-full p-2 border rounded mt-1"
                          placeholder="Materiales, Herramientas..."
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="text-xs text-gray-500">Notas</label>
                      <textarea
                        value={factura.notas}
                        onChange={(e) => actualizarFactura(factura.id, 'notas', e.target.value)}
                        className="w-full p-2 border rounded mt-1"
                        rows="2"
                        placeholder="Notas adicionales sobre esta compra..."
                      />
                    </div>

                    {factura.items && factura.items.length > 0 && (
                      <div className="mt-3">
                        <label className="text-xs text-gray-500">Items detectados:</label>
                        <p className="text-sm text-gray-600 mt-1">{factura.items.join(', ')}</p>
                      </div>
                    )}

                    {factura.archivoUrl && (
                      <div className="mt-3">
                        {factura.tipoArchivo?.includes('pdf') ? (
                          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded">
                            <FileText size={32} />
                            <div>
                              <p className="font-semibold">PDF adjunto</p>
                              <a href={factura.archivoUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-red-800">
                                Ver PDF: {factura.nombreArchivo}
                              </a>
                            </div>
                          </div>
                        ) : (
                          <img src={factura.archivoUrl} alt="Factura" className="max-w-xs rounded border" />
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex gap-2 flex-wrap">
                      <button
                        onClick={() => actualizarFactura(factura.id, 'pagada', !factura.pagada)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                          factura.pagada 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {factura.pagada ? <Check size={18} /> : <X size={18} />}
                        {factura.pagada ? 'PAGADA' : 'PENDIENTE'}
                      </button>
                      
                      <button
                        onClick={() => eliminarFactura(factura.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center gap-2"
                      >
                        <Trash2 size={18} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!clienteActual && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl text-gray-600 mb-2">Comienza seleccionando o agregando un cliente</h3>
            <p className="text-gray-500">Luego podrás subir fotos de facturas y gestionar los gastos</p>
          </div>
        )}
      </div>
    </div>
  );
}