const { runSync } = require('../src/index.js');

module.exports = async (req, res) => {
  try {
    // Protección simple mediante token (opcional, configurar en variables de entorno Vercel)
    if (process.env.SYNC_TOKEN && req.headers.authorization !== `Bearer ${process.env.SYNC_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('Iniciando sincronización desde Vercel...');
    const result = await runSync();
    
    res.status(200).json({ 
      message: 'Sincronización completada exitosamente',
      details: result
    });
  } catch (error) {
    console.error('Error en Vercel Serverless Function:', error);
    res.status(500).json({ 
      error: 'Hubo un error durante la sincronización',
      message: error.message 
    });
  }
};
