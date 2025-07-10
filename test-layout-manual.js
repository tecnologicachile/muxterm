// Script manual para probar la persistencia del layout
const axios = require('axios');

console.log('=== Test Manual de Persistencia de Layout ===\n');

async function testLayoutPersistence() {
  try {
    // 1. Login
    console.log('1. Haciendo login...');
    const loginResponse = await axios.post('http://localhost:3002/api/auth/login', {
      username: 'test',
      password: 'test123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login exitoso, token obtenido');
    
    // 2. Obtener sesiones
    console.log('\n2. Obteniendo lista de sesiones...');
    const sessionsResponse = await axios.get('http://localhost:3002/api/sessions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✓ Encontradas ${sessionsResponse.data.length} sesiones:`);
    sessionsResponse.data.forEach(session => {
      console.log(`   - ${session.name}: ${session.layoutInfo || session.terminals + ' terminal(s)'}`);
    });
    
    // 3. Buscar sesión con múltiples paneles
    const multiPanelSession = sessionsResponse.data.find(s => 
      s.panelCount > 1 || s.terminals > 1
    );
    
    if (multiPanelSession) {
      console.log(`\n3. Sesión con múltiples paneles encontrada:`);
      console.log(`   ID: ${multiPanelSession.id}`);
      console.log(`   Nombre: ${multiPanelSession.name}`);
      console.log(`   Layout: ${multiPanelSession.layoutInfo}`);
      console.log(`   Paneles: ${multiPanelSession.panelCount}`);
      console.log(`   Terminales: ${multiPanelSession.terminals}`);
      
      console.log('\n✅ Para restaurar esta distribución:');
      console.log('   1. Abre http://localhost:3003 en tu navegador');
      console.log('   2. Inicia sesión con test/test123');
      console.log(`   3. Haz clic en la sesión "${multiPanelSession.name}"`);
      console.log('   4. La distribución se restaurará automáticamente');
    } else {
      console.log('\n⚠️  No se encontraron sesiones con múltiples paneles');
      console.log('   Crea una sesión con paneles divididos primero');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Respuesta del servidor:', error.response.data);
    }
  }
}

testLayoutPersistence();