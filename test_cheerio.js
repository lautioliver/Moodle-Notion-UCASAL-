const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('campus_source.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- Bloques en la página ---');
$('section.block').each((i, el) => {
  const className = $(el).attr('class');
  const title = $(el).find('h3').text().trim() || $(el).find('h2').text().trim();
  console.log(`Block [${i}]: ${className} - Title: ${title}`);
});

console.log('\n--- Extrayendo datos de .event ---');
$('.event').each((i, el) => {
  const name = $(el).find('.name, h3, .text-truncate').text().trim();
  const date = $(el).find('.date, .time').text().trim() || $(el).text().match(/\d{1,2}\sde\s[a-z]+/i);
  const course = $(el).find('.course, .text-muted').text().trim();
  const href = $(el).find('a').attr('href');
  
  console.log(`\nEvento ${i}:`);
  console.log(`Name: ${name}`);
  console.log(`Date: ${date}`);
  console.log(`Course: ${course}`);
  console.log(`URL: ${href}`);
  if (i === 0) {
    console.log(`HTML Interno (primer evento):\n${$(el).html()}`);
  }
});

console.log('\n--- Buscando cursos agrupadores ---');
$('.list-group-item').each((i, el) => {
  const courseName = $(el).find('h5, .course-name, h4, h3').first().text().trim();
  const eventsInGroup = $(el).find('.event').length;
  if (eventsInGroup > 0) {
    console.log(`Grupo ${i}: Curso = ${courseName} | Eventos = ${eventsInGroup}`);
  }
});
