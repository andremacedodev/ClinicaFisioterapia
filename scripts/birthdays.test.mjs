import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingBirthdays, whatsappLink } from '../src/lib/birthdays.js';

const ref = new Date(2026, 10, 26, 10, 0); // 26/11/2026 10h

test('hoje, amanhã e até 7 dias; fora da janela não entra; ordem por proximidade', () => {
  const list = upcomingBirthdays([
    { id: 'c', full_name: 'Carla', birth_date: '1990-12-03' }, // 7 dias
    { id: 'a', full_name: 'Ana', birth_date: '1980-11-26' }, // hoje
    { id: 'b', full_name: 'Bia', birth_date: '2000-11-27' }, // amanhã
    { id: 'd', full_name: 'Duda', birth_date: '1995-12-04' }, // 8 dias: fora
    { id: 'e', full_name: 'Eva', birth_date: '1970-11-25' }, // ontem: fora
    { id: 'f', full_name: 'Fe', birth_date: null },
  ], ref, 7);
  assert.deepEqual(list.map((item) => item.id), ['a', 'b', 'c']);
  assert.equal(list[0].label, 'Hoje');
  assert.equal(list[0].age, 46);
  assert.equal(list[1].label, 'Amanhã');
  assert.equal(list[1].age, 26);
  assert.equal(list[2].daysUntil, 7);
});

test('virada de ano: aniversário em janeiro aparece no fim de dezembro', () => {
  const list = upcomingBirthdays([{ id: 'j', full_name: 'Jo', birth_date: '1990-01-02' }], new Date(2026, 11, 29), 7);
  assert.equal(list.length, 1);
  assert.equal(list[0].daysUntil, 4);
  assert.equal(list[0].age, 37);
});

test('link do WhatsApp com DDI 55 e sem telefone', () => {
  assert.equal(whatsappLink('(65) 99999-0000'), 'https://wa.me/5565999990000');
  assert.equal(whatsappLink('+55 65 99999-0000'), 'https://wa.me/5565999990000');
  assert.equal(whatsappLink(''), null);
  assert.equal(whatsappLink(null), null);
});
