const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configuración del servidor
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para analizar solicitudes con content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// Middleware para analizar solicitudes con content-type - application/json
app.use(bodyParser.json());

// Configuración de la base de datos
const dbPath = path.join(__dirname, 'sigfox_data.db');
const db = new sqlite3.Database(dbPath);

// Crear tabla si no existe
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS device_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device TEXT,
      time TEXT,
      station TEXT,
      data TEXT,
      rssi INTEGER,
      seqNumber INTEGER,
      deviceTypeId TEXT,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Ruta para recibir callbacks de Sigfox
app.post('/sigfox/callback', (req, res) => {
  console.log('Callback recibido:', req.body);
  
  const { device, time, station, data, rssi, seqNumber, deviceTypeId } = req.body;
  
  // Insertar datos en la base de datos
  const stmt = db.prepare(`
    INSERT INTO device_data (device, time, station, data, rssi, seqNumber, deviceTypeId)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(device, time, station, data, rssi, seqNumber, deviceTypeId, (err) => {
    if (err) {
      console.error('Error al guardar en la base de datos:', err);
      return res.status(500).json({ error: 'Error al guardar datos' });
    }
    
    console.log('Datos guardados correctamente');
    res.status(200).json({ status: 'success', message: 'Datos recibidos y almacenados' });
  });
  
  stmt.finalize();
});

// Ruta para obtener los datos almacenados (página web)
app.get('/', (req, res) => {
  db.all('SELECT * FROM device_data ORDER BY received_at DESC LIMIT 100', [], (err, rows) => {
    if (err) {
      console.error('Error al consultar la base de datos:', err);
      return res.status(500).send('Error al obtener datos');
    }
    
    // Generar HTML para mostrar los datos
    let html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Datos de dispositivos Sigfox</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
          }
          h1 {
            color: #333;
            text-align: center;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background-color: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #4CAF50;
            color: white;
          }
          tr:nth-child(even) {
            background-color: #f2f2f2;
          }
          tr:hover {
            background-color: #ddd;
          }
          .refresh {
            display: block;
            width: 200px;
            margin: 20px auto;
            padding: 10px;
            background-color: #4CAF50;
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <h1>Datos de dispositivos Sigfox</h1>
        <a href="/" class="refresh">Actualizar datos</a>
        <table>
          <tr>
            <th>ID</th>
            <th>Dispositivo</th>
            <th>Hora</th>
            <th>Estación</th>
            <th>Datos</th>
            <th>RSSI</th>
            <th>Número de secuencia</th>
            <th>ID de tipo de dispositivo</th>
            <th>Recibido</th>
          </tr>
    `;
    
    rows.forEach(row => {
      html += `
        <tr>
          <td>${row.id}</td>
          <td>${row.device}</td>
          <td>${row.time}</td>
          <td>${row.station}</td>
          <td>${row.data}</td>
          <td>${row.rssi}</td>
          <td>${row.seqNumber}</td>
          <td>${row.deviceTypeId}</td>
          <td>${row.received_at}</td>
        </tr>
      `;
    });
    
    html += `
        </table>
      </body>
      </html>
    `;
    
    res.send(html);
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
  console.log(`Ruta para callbacks de Sigfox: http://localhost:${PORT}/sigfox/callback`);
});

// Manejar cierre de la aplicación
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error al cerrar la base de datos:', err);
    } else {
      console.log('Conexión a la base de datos cerrada');
    }
    process.exit(0);
  });
});
