import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAppointmentNotes, isSameInstant, splitAppointmentNotes } from '../src/lib/appointmentNotes.js';

const accumulated =
  'Renovação: aula 9/12 do novo pacote. Remarcação: de 26/10/2026 08:00-09:00 para 27/10/2026 17:00-18:00. Remarcação: de 27/10/2026 17:00-18:00 para 29/10/2026 17:00-18:00. Remarcação: de 29/10/2026 17:00-18:00 para 03/11/2026 17:00-18:00. Remarcação: de 03/11/2026 17:00-18:00 para 03/11/2026 17:00-18:00. Remarcação: de 03/11/2026 17:00-18:00 para 03/11/2026 16:00-17:00.';

test('o texto do caso real fica só com a última remarcação', () => {
  const notes = buildAppointmentNotes({ notes: accumulated });
  assert.equal(
    notes,
    'Renovação: aula 9/12 do novo pacote.\nRemarcação: de 03/11/2026 17:00-18:00 para 03/11/2026 16:00-17:00.',
  );
});

test('uma nova remarcação substitui as anteriores', () => {
  const notes = buildAppointmentNotes({
    notes: accumulated,
    newReschedule: 'Remarcação: de 03/11/2026 16:00-17:00 para 05/11/2026 08:00-09:00.',
  });
  assert.equal(
    notes,
    'Renovação: aula 9/12 do novo pacote.\nRemarcação: de 03/11/2026 16:00-17:00 para 05/11/2026 08:00-09:00.',
  );
  assert.equal((notes.match(/Remarcação:/g) ?? []).length, 1);
});

test('editar várias vezes não acumula (resultado salvo volta como entrada)', () => {
  let notes = 'Trazer exame';
  for (const [from, to] of [['01/12', '02/12'], ['02/12', '03/12'], ['03/12', '04/12']]) {
    notes = buildAppointmentNotes({
      notes,
      newReschedule: `Remarcação: de ${from}/2026 08:00-09:00 para ${to}/2026 08:00-09:00.`,
    });
  }
  assert.equal(notes, 'Trazer exame\nRemarcação: de 03/12/2026 08:00-09:00 para 04/12/2026 08:00-09:00.');
});

test('a marca de correção avulsa aparece uma vez só', () => {
  let notes = buildAppointmentNotes({ notes: 'Obs', manualCorrection: true });
  notes = buildAppointmentNotes({ notes, manualCorrection: true });
  notes = buildAppointmentNotes({ notes, manualCorrection: false });
  assert.equal(notes, '[CORREÇÃO AVULSA]\nObs');
});

test('observação escrita pela clínica é preservada', () => {
  const { userText, lastReschedule } = splitAppointmentNotes(
    'Paciente com dor no joelho\nRemarcação: de 01/12/2026 08:00-09:00 para 02/12/2026 08:00-09:00.',
  );
  assert.equal(userText, 'Paciente com dor no joelho');
  assert.equal(lastReschedule, 'Remarcação: de 01/12/2026 08:00-09:00 para 02/12/2026 08:00-09:00.');
});

test('mesmo horário em formatos diferentes não conta como remarcação', () => {
  assert.equal(isSameInstant('2026-11-03T21:00:00+00:00', '2026-11-03T21:00:00.000Z'), true);
  assert.equal(isSameInstant('2026-11-03T21:00:00+00:00', '2026-11-03T20:00:00.000Z'), false);
});

test('sem observações fica vazio', () => {
  assert.equal(buildAppointmentNotes({ notes: null }), '');
});
