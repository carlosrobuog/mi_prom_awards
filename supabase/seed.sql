-- Datos de demostración (ficticios). Ejecutar después de la migración.

insert into public.categories (name, description, icon, position) values
  ('El más tardón del año', 'Porque llegar a la hora nunca ha sido precisamente su especialidad.', 'clock', 1),
  ('El más renegón', 'Tiene una queja lista para cada ocasión, y casi siempre tiene algo de razón.', 'bolt', 2),
  ('El más coqueto/a', 'Sonrisa ensayada, mirada calculada y cero remordimientos.', 'eye', 3),
  ('El más tacaño', 'Su billetera tiene más seguridad que un banco. Nunca se sabe cuándo va a invitar.', 'coin', 4),
  ('El más desaparecido', 'Lo viste por última vez en la graduación. Desde entonces, solo hay rumores.', 'ghost', 5),
  ('El más chismoso/a', 'Se enteró antes que nadie y lo contó antes de que terminara la frase.', 'chat', 6),
  ('El más juerguero/a', 'Donde hay música, hay una historia que contar al día siguiente.', 'glass', 7),
  ('El más figureti', 'Si hay una cámara, ya está posando. Si no la hay, también.', 'camera', 8),
  ('El más gracioso/a', 'Sus chistes no siempre aterrizan, pero la risa está asegurada.', 'smile', 9),
  ('El personaje del año', 'Nunca pasa desapercibido. La promoción no sería la misma sin él o ella.', 'crown', 10);

insert into public.participants (name, photo_url) values
  ('Carlos Mendoza', 'assets/img/p60.jpg'),
  ('Miguel Torres', 'assets/img/p59.jpg'),
  ('Andrea Salazar', 'assets/img/p16.jpg'),
  ('Rodrigo Pérez', 'assets/img/p12.jpg'),
  ('Valeria Castro', 'assets/img/p36.jpg');
