/**
 * Catálogo de íconos de Ámbitos, Categorías, Subcategorías y Medios de pago (sin dependencias de React: se usa también
 * para sugerir íconos y se prueba con Vitest). Los identificadores son estables y los guarda la base de datos
 * (`is_valid_icon`). Un mismo ícono usado en varios contextos aparece una sola vez: los demás usos son sinónimos de búsqueda.
 */
export interface IconoCatalogo {
  id: string
  nombre: string
  seccion: string
  /** Sinónimos y usos típicos, sin tildes ni mayúsculas. La primera es la principal. */
  palabras: string[]
}

export const SECCIONES_ICONOS = [
  {
    "id": "personas",
    "nombre": "Personas y ámbitos"
  },
  {
    "id": "alimentacion",
    "nombre": "Alimentación"
  },
  {
    "id": "transporte",
    "nombre": "Transporte y auto"
  },
  {
    "id": "hogar",
    "nombre": "Hogar"
  },
  {
    "id": "servicios",
    "nombre": "Servicios"
  },
  {
    "id": "salud",
    "nombre": "Salud y cuidado personal"
  },
  {
    "id": "educacion",
    "nombre": "Educación"
  },
  {
    "id": "compras",
    "nombre": "Compras y ropa"
  },
  {
    "id": "tecnologia",
    "nombre": "Tecnología y suscripciones"
  },
  {
    "id": "dinero",
    "nombre": "Dinero y medios de pago"
  },
  {
    "id": "viajes",
    "nombre": "Viajes y salidas"
  },
  {
    "id": "ocio",
    "nombre": "Bebé, ocio y otros"
  }
] as const

export const ICONOS_CATALOGO: IconoCatalogo[] = [
  { id: 'user', nombre: 'Persona', seccion: 'personas', palabras: ["persona","yo","personal","usuario","individual"] },
  { id: 'users', nombre: 'Familia', seccion: 'personas', palabras: ["familia","familiar","familiares","hogar familiar","grupo","padres","hijos"] },
  { id: 'briefcase', nombre: 'Trabajo', seccion: 'personas', palabras: ["trabajo","laboral","oficina","empleo","negocio","profesional","sueldo"] },
  { id: 'heart', nombre: 'Pareja', seccion: 'personas', palabras: ["pareja","novia","novio","esposa","esposo","amor","romantico","aniversario","san valentin"] },
  { id: 'party-popper', nombre: 'Amigos y celebración', seccion: 'personas', palabras: ["amigos","celebracion","fiesta","reunion","salida con amigos","juerga","brindis"] },
  { id: 'baby', nombre: 'Bebé', seccion: 'personas', palabras: ["bebe","infantil","cuidado infantil","recien nacido","nino","ninos","hijo","panales"] },
  { id: 'heart-handshake', nombre: 'Apoyo familiar', seccion: 'personas', palabras: ["apoyo familiar","ayuda familiar","apoyo","solidaridad","donacion","ayuda"] },
  { id: 'hand-coins', nombre: 'Apoyo económico', seccion: 'personas', palabras: ["apoyo economico","prestamo","ayuda economica","mesada","propina","aporte"] },
  { id: 'contact', nombre: 'Contacto', seccion: 'personas', palabras: ["contacto","agenda","conocido","referencia"] },
  { id: 'paw-print', nombre: 'Mascota', seccion: 'personas', palabras: ["mascota","mascotas","perro","gato","veterinario","veterinaria","animal"] },
  { id: 'utensils', nombre: 'Comida y almuerzo', seccion: 'alimentacion', palabras: ["alimentacion","comida","almuerzo","cena","cubiertos","menu","restaurante","comer"] },
  { id: 'coffee', nombre: 'Desayuno y café', seccion: 'alimentacion', palabras: ["desayuno","cafe","cafeteria","infusion","te","merienda"] },
  { id: 'pizza', nombre: 'Delivery y pizza', seccion: 'alimentacion', palabras: ["pizza","delivery","pedido","pollo","comida rapida","para llevar"] },
  { id: 'cup-soda', nombre: 'Bebidas', seccion: 'alimentacion', palabras: ["bebida","bebidas","gaseosa","refresco","jugo","agua mineral","cerveza","trago"] },
  { id: 'candy', nombre: 'Antojos y dulces', seccion: 'alimentacion', palabras: ["antojo","antojos","dulce","dulces","golosina","chocolate","snack","snacks"] },
  { id: 'sandwich', nombre: 'Hamburguesa y sándwich', seccion: 'alimentacion', palabras: ["hamburguesa","sandwich","pan","bocadillo","hot dog"] },
  { id: 'apple', nombre: 'Frutas', seccion: 'alimentacion', palabras: ["fruta","frutas","manzana","mercado","verduras","fresco"] },
  { id: 'salad', nombre: 'Comida saludable', seccion: 'alimentacion', palabras: ["ensalada","saludable","vegetal","dieta","vegano","vegetariano"] },
  { id: 'cake-slice', nombre: 'Postres', seccion: 'alimentacion', palabras: ["postre","postres","pastel","torta","pasteleria","panaderia","dulceria"] },
  { id: 'ice-cream-bowl', nombre: 'Helados', seccion: 'alimentacion', palabras: ["helado","helados","heladeria","sorbete"] },
  { id: 'car', nombre: 'Auto', seccion: 'transporte', palabras: ["auto","carro","coche","vehiculo","movilidad propia","automovil"] },
  { id: 'taxi', nombre: 'Taxi', seccion: 'transporte', palabras: ["taxi","uber","cabify","indriver","mototaxi","carrera"] },
  { id: 'bus', nombre: 'Bus y micro', seccion: 'transporte', palabras: ["bus","micro","combi","transporte publico","colectivo","metropolitano","pasaje"] },
  { id: 'bike', nombre: 'Bicicleta', seccion: 'transporte', palabras: ["bicicleta","bici","ciclismo","moto","scooter"] },
  { id: 'fuel', nombre: 'Combustible', seccion: 'transporte', palabras: ["combustible","gasolina","gasohol","petroleo","diesel","grifo","gnv","glp","tanque"] },
  { id: 'parking', nombre: 'Estacionamiento', seccion: 'transporte', palabras: ["estacionamiento","parqueo","cochera","playa de estacionamiento","garaje"] },
  { id: 'wrench', nombre: 'Mantenimiento', seccion: 'transporte', palabras: ["mantenimiento","mecanico","taller","reparacion","servicio tecnico","repuestos","cambio de aceite"] },
  { id: 'shield', nombre: 'Seguro', seccion: 'transporte', palabras: ["seguro","seguro vehicular","soat","poliza","seguro de auto","proteccion"] },
  { id: 'shield-check', nombre: 'Revisión técnica', seccion: 'transporte', palabras: ["revision tecnica","inspeccion","certificado","verificacion","homologacion"] },
  { id: 'route', nombre: 'Peajes y ruta', seccion: 'transporte', palabras: ["peaje","peajes","ruta","carretera","viaje por carretera","autopista"] },
  { id: 'house', nombre: 'Casa', seccion: 'hogar', palabras: ["casa","hogar","vivienda","alquiler","renta","departamento","inmueble","hipoteca","mantenimiento del hogar"] },
  { id: 'shopping-cart', nombre: 'Supermercado', seccion: 'hogar', palabras: ["supermercado","compras del hogar","despensa","abarrotes","mercado","carrito","bodega"] },
  { id: 'spray-can', nombre: 'Limpieza y perfumes', seccion: 'hogar', palabras: ["limpieza","aseo","detergente","desinfectante","perfume","perfumes","fragancia","ambientador"] },
  { id: 'washing-machine', nombre: 'Lavadora', seccion: 'hogar', palabras: ["lavadora","lavanderia","lavado","ropa sucia"] },
  { id: 'refrigerator', nombre: 'Refrigerador', seccion: 'hogar', palabras: ["refrigerador","refri","nevera","congeladora","electrodomestico"] },
  { id: 'sofa', nombre: 'Muebles y sofá', seccion: 'hogar', palabras: ["mueble","muebles","sofa","sala","decoracion","sillon","mueblería"] },
  { id: 'bed-double', nombre: 'Cama', seccion: 'hogar', palabras: ["cama","colchon","dormitorio","habitacion","sabanas","descanso"] },
  { id: 'hammer', nombre: 'Reparaciones', seccion: 'hogar', palabras: ["reparacion","reparaciones","arreglo","gasfitero","albanil","construccion","obra"] },
  { id: 'drill', nombre: 'Herramientas', seccion: 'hogar', palabras: ["herramienta","herramientas","taladro","ferreteria","bricolaje"] },
  { id: 'trash-2', nombre: 'Basura', seccion: 'hogar', palabras: ["basura","papelera","residuos","desechos","recojo"] },
  { id: 'zap', nombre: 'Luz y electricidad', seccion: 'servicios', palabras: ["luz","electricidad","electrico","energia","recibo de luz","corriente"] },
  { id: 'droplets', nombre: 'Agua', seccion: 'servicios', palabras: ["agua","recibo de agua","sedapal","potable","desague","saneamiento"] },
  { id: 'flame', nombre: 'Gas', seccion: 'servicios', palabras: ["gas","balon de gas","cocina","calefaccion","calentador"] },
  { id: 'wifi', nombre: 'Internet', seccion: 'servicios', palabras: ["internet","wifi","fibra","banda ancha","router","conexion","movistar","claro","entel"] },
  { id: 'smartphone', nombre: 'Celular y línea móvil', seccion: 'servicios', palabras: ["celular","movil","linea celular","plan celular","recarga","smartphone","yape","plin","telefono movil"] },
  { id: 'phone', nombre: 'Teléfono', seccion: 'servicios', palabras: ["telefono","llamada","fijo","telefonia","central"] },
  { id: 'tv', nombre: 'Televisión', seccion: 'servicios', palabras: ["television","tv","cable tv","tele","antena","decodificador"] },
  { id: 'receipt', nombre: 'Recibos', seccion: 'servicios', palabras: ["recibo","recibos","factura","boleta","comprobante","cuota","servicios"] },
  { id: 'cable', nombre: 'Cable y conexión', seccion: 'servicios', palabras: ["cable","conexion","instalacion","conectividad"] },
  { id: 'settings', nombre: 'Servicio técnico', seccion: 'servicios', palabras: ["servicio tecnico","configuracion","ajustes","soporte","tecnico","mantenimiento de equipos"] },
  { id: 'stethoscope', nombre: 'Consulta médica', seccion: 'salud', palabras: ["consulta","medico","doctor","cita medica","salud","clinica","control","pediatra"] },
  { id: 'pill', nombre: 'Medicamentos', seccion: 'salud', palabras: ["medicamento","medicamentos","pastilla","pastillas","botica","farmacia","receta","vitaminas"] },
  { id: 'hospital', nombre: 'Hospital y emergencias', seccion: 'salud', palabras: ["hospital","emergencia","emergencias","urgencia","clinica","internamiento","essalud"] },
  { id: 'briefcase-medical', nombre: 'Botiquín', seccion: 'salud', palabras: ["botiquin","primeros auxilios","curaciones","medico portatil"] },
  { id: 'test-tubes', nombre: 'Exámenes médicos', seccion: 'salud', palabras: ["examen","examenes","laboratorio","analisis","chequeo","analisis de sangre","prueba"] },
  { id: 'activity', nombre: 'Odontología y terapia', seccion: 'salud', palabras: ["odontologia","dentista","dental","terapia","fisioterapia","rehabilitacion","ortodoncia"] },
  { id: 'scissors', nombre: 'Barbería y peluquería', seccion: 'salud', palabras: ["barberia","peluqueria","corte","corte de cabello","cabello","estilista","barbero","salon"] },
  { id: 'soap-dispenser-droplet', nombre: 'Higiene personal', seccion: 'salud', palabras: ["higiene","jabon","aseo personal","shampoo","desodorante","cuidado del cuerpo"] },
  { id: 'dumbbell', nombre: 'Gimnasio', seccion: 'salud', palabras: ["gimnasio","gym","ejercicio","deporte","entrenamiento","fitness","pesas"] },
  { id: 'sparkles', nombre: 'Cuidado personal', seccion: 'salud', palabras: ["cuidado personal","belleza","estetica","spa","cosmetico","maquillaje","skincare"] },
  { id: 'graduation-cap', nombre: 'Estudios y grados', seccion: 'educacion', palabras: ["estudios","grado","universidad","carrera","pension","maestria","titulo","educacion"] },
  { id: 'book', nombre: 'Libros', seccion: 'educacion', palabras: ["libro","libros","libreria","lectura","texto","novela","manual"] },
  { id: 'book-open', nombre: 'Cursos y lectura', seccion: 'educacion', palabras: ["curso","cursos","capacitacion","taller","clase","lectura","aprendizaje en linea"] },
  { id: 'award', nombre: 'Certificaciones', seccion: 'educacion', palabras: ["certificacion","certificado","premio","logro","diploma de honor","acreditacion"] },
  { id: 'scroll-text', nombre: 'Diploma', seccion: 'educacion', palabras: ["diploma","constancia","titulo profesional","pergamino"] },
  { id: 'presentation', nombre: 'Clases y presentaciones', seccion: 'educacion', palabras: ["clases","presentacion","exposicion","seminario","conferencia","academia"] },
  { id: 'file-text', nombre: 'Matrícula y documentos', seccion: 'educacion', palabras: ["matricula","documento","documentos","tramite academico","carta","expediente","inscripcion"] },
  { id: 'pencil-ruler', nombre: 'Útiles escolares', seccion: 'educacion', palabras: ["utiles","utiles escolares","cuadernos","colegio","mochila","papeleria","lapices"] },
  { id: 'school', nombre: 'Escuela y universidad', seccion: 'educacion', palabras: ["escuela","colegio","universidad","instituto","jardin","nido","pension escolar"] },
  { id: 'brain', nombre: 'Aprendizaje', seccion: 'educacion', palabras: ["aprendizaje","mente","psicologia","idiomas","ingles","estudio","terapia psicologica"] },
  { id: 'shopping-bag', nombre: 'Compras', seccion: 'compras', palabras: ["compras","tienda","bolsa","shopping","mall","centro comercial","adquisiciones"] },
  { id: 'shirt', nombre: 'Ropa', seccion: 'compras', palabras: ["ropa","vestimenta","camisa","polo","pantalon","vestido","moda","prendas"] },
  { id: 'footprints', nombre: 'Calzado', seccion: 'compras', palabras: ["calzado","zapatos","zapatillas","botas","sandalias","pisadas"] },
  { id: 'watch', nombre: 'Accesorios y reloj', seccion: 'compras', palabras: ["accesorios","reloj","cartera","lentes","correa","complementos"] },
  { id: 'gem', nombre: 'Joyas', seccion: 'compras', palabras: ["joya","joyas","joyeria","anillo","collar","oro","plata","alianza"] },
  { id: 'gift', nombre: 'Regalos', seccion: 'compras', palabras: ["regalo","regalos","obsequio","presente","detalle","sorpresa"] },
  { id: 'package', nombre: 'Paquetes', seccion: 'compras', palabras: ["paquete","paquetes","envio","encomienda","courier","pedido online","amazon"] },
  { id: 'store', nombre: 'Tienda', seccion: 'compras', palabras: ["tienda","comercio","negocio","local","boutique","bodega"] },
  { id: 'badge-percent', nombre: 'Ofertas y descuentos', seccion: 'compras', palabras: ["oferta","ofertas","descuento","promocion","cupon","rebaja","outlet"] },
  { id: 'laptop', nombre: 'Computadora portátil', seccion: 'tecnologia', palabras: ["laptop","notebook","portatil","computadora","pc","macbook"] },
  { id: 'monitor', nombre: 'Computadora de escritorio', seccion: 'tecnologia', palabras: ["monitor","escritorio","pantalla","desktop","computadora de escritorio","equipo"] },
  { id: 'code', nombre: 'Software y programación', seccion: 'tecnologia', palabras: ["software","programacion","codigo","desarrollo","licencia","app","aplicacion","github"] },
  { id: 'cloud', nombre: 'Servicios en la nube', seccion: 'tecnologia', palabras: ["nube","cloud","almacenamiento","hosting en la nube","drive","icloud","dropbox"] },
  { id: 'globe', nombre: 'Página web y hosting', seccion: 'tecnologia', palabras: ["web","pagina web","hosting","dominio","sitio","internacional","online"] },
  { id: 'bot', nombre: 'Inteligencia artificial', seccion: 'tecnologia', palabras: ["inteligencia artificial","ia","chatgpt","claude","asistente","robot","bot"] },
  { id: 'gamepad-2', nombre: 'Videojuegos', seccion: 'tecnologia', palabras: ["videojuego","videojuegos","juegos","consola","playstation","xbox","nintendo","steam","gamer"] },
  { id: 'music', nombre: 'Música', seccion: 'tecnologia', palabras: ["musica","spotify","concierto","canciones","instrumento","disco"] },
  { id: 'clapperboard', nombre: 'Películas y streaming', seccion: 'tecnologia', palabras: ["pelicula","peliculas","streaming","netflix","series","cine en casa","disney","hbo","prime video"] },
  { id: 'repeat', nombre: 'Suscripción recurrente', seccion: 'tecnologia', palabras: ["suscripcion","suscripciones","recurrente","mensualidad","membresia","renovacion","plan mensual"] },
  { id: 'wallet', nombre: 'Billetera', seccion: 'dinero', palabras: ["billetera","monedero","cartera digital","yape","plin","fondos","saldo","efectivo disponible"] },
  { id: 'credit-card', nombre: 'Tarjeta', seccion: 'dinero', palabras: ["tarjeta","tarjeta de credito","tarjeta de debito","credito","debito","vale","sodexo","visa","mastercard","ticket de alimentacion"] },
  { id: 'banknote', nombre: 'Efectivo', seccion: 'dinero', palabras: ["efectivo","billete","billetes","cash","dinero en mano"] },
  { id: 'landmark', nombre: 'Banco', seccion: 'dinero', palabras: ["banco","cuenta","bancario","financiera","caja","interbank","bcp","bbva","scotiabank"] },
  { id: 'arrow-left-right', nombre: 'Transferencia', seccion: 'dinero', palabras: ["transferencia","transferir","envio de dinero","deposito","interbancaria","cci"] },
  { id: 'coins', nombre: 'Monedas', seccion: 'dinero', palabras: ["monedas","sencillo","cambio","monedero","centavos"] },
  { id: 'piggy-bank', nombre: 'Ahorro', seccion: 'dinero', palabras: ["ahorro","ahorros","alcancia","reserva","fondo de ahorro","cts","emergencia financiera"] },
  { id: 'calculator', nombre: 'Presupuesto', seccion: 'dinero', palabras: ["presupuesto","calculo","cuentas","contabilidad","impuestos","sunat"] },
  { id: 'trending-up', nombre: 'Ingresos', seccion: 'dinero', palabras: ["ingreso","ingresos","ganancia","sueldo","subida","aumento","inversion"] },
  { id: 'trending-down', nombre: 'Gastos', seccion: 'dinero', palabras: ["gasto","gastos","baja","perdida","disminucion","egresos"] },
  { id: 'plane', nombre: 'Viajes y avión', seccion: 'viajes', palabras: ["viaje","viajes","avion","vuelo","pasaje aereo","aeropuerto","vacaciones","turismo"] },
  { id: 'luggage', nombre: 'Equipaje', seccion: 'viajes', palabras: ["equipaje","maleta","valija","viaje a","viaje a ica","equipaje de mano","mochila de viaje"] },
  { id: 'hotel', nombre: 'Hotel y hospedaje', seccion: 'viajes', palabras: ["hotel","hospedaje","alojamiento","airbnb","hostal","reserva de hotel","resort"] },
  { id: 'umbrella', nombre: 'Playa', seccion: 'viajes', palabras: ["playa","verano","sombrilla","costa","piscina","balneario"] },
  { id: 'tent', nombre: 'Camping', seccion: 'viajes', palabras: ["camping","carpa","acampar","campo","naturaleza","excursion"] },
  { id: 'map-pin', nombre: 'Paseos y ubicación', seccion: 'viajes', palabras: ["paseo","paseos","ubicacion","lugar","turismo local","salida","direccion","mapa"] },
  { id: 'ticket', nombre: 'Entradas y actividades', seccion: 'viajes', palabras: ["entrada","entradas","ticket","boleto","actividad","actividades","evento","espectaculo"] },
  { id: 'film', nombre: 'Cine', seccion: 'viajes', palabras: ["cine","pelicula en cine","funcion","cinemark","cineplanet"] },
  { id: 'camera', nombre: 'Fotografía y recuerdos', seccion: 'viajes', palabras: ["fotografia","fotos","recuerdos","camara","album","sesion de fotos"] },
  { id: 'cooking-pot', nombre: 'Restaurantes', seccion: 'viajes', palabras: ["restaurantes","restaurante","cevicheria","chifa","almuerzo fuera","comida fuera","cena fuera","parrilla"] },
  { id: 'toy-brick', nombre: 'Juguetes', seccion: 'ocio', palabras: ["juguete","juguetes","lego","juego infantil","bloques","jugueteria"] },
  { id: 'puzzle', nombre: 'Juegos y rompecabezas', seccion: 'ocio', palabras: ["juegos","rompecabezas","puzzle","juego de mesa","pasatiempo","hobby"] },
  { id: 'laugh', nombre: 'Diversión', seccion: 'ocio', palabras: ["diversion","risa","entretenimiento","ocio","humor","parque de diversiones"] },
  { id: 'cake', nombre: 'Cumpleaños', seccion: 'ocio', palabras: ["cumpleanos","cumple","pastel de cumpleanos","aniversario","fiesta de cumpleanos"] },
  { id: 'star', nombre: 'Fecha especial', seccion: 'ocio', palabras: ["fecha especial","favorito","especial","navidad","dia de la madre","ocasion especial","destacado"] },
  { id: 'volleyball', nombre: 'Deportes', seccion: 'ocio', palabras: ["deporte","deportes","futbol","voleibol","pelota","partido","cancha","club"] },
  { id: 'triangle-alert', nombre: 'Imprevistos', seccion: 'ocio', palabras: ["imprevisto","imprevistos","emergencia inesperada","alerta","multa","urgente","sorpresa desagradable"] },
  { id: 'clipboard-list', nombre: 'Trámites', seccion: 'ocio', palabras: ["tramite","tramites","gestion","notaria","licencia de conducir","registro","documentos oficiales","lista"] },
  { id: 'circle-help', nombre: 'Por clasificar', seccion: 'ocio', palabras: ["por clasificar","pendiente","sin clasificar","duda","varios","desconocido"] },
  { id: 'shapes', nombre: 'Otros', seccion: 'ocio', palabras: ["otros","otro","miscelaneo","diversos","general","varios gastos"] },
]

/** Claves guardadas antes de este catálogo que siguen siendo válidas: se mapean al ícono actual (o se conservan tal cual). */
export const ALIAS_ICONOS: Record<string, string> = { home: 'house' }
/** Claves antiguas sin sección: se muestran bien donde ya estaban guardadas pero no se ofrecen para elegir. */
export const ICONOS_HEREDADOS = ["tag","circle-ellipsis","home"]
