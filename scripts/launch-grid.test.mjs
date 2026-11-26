/* global process */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLaunchGrid, monthDays } from '../src/lib/launchGrid.js';
import { buildCommissionDetailReport } from '../src/lib/commission.js';

process.env.TZ = 'America/Cuiaba';

const at = (day, hour) => new Date(2026, 10, day, hour, 0).toISOString();
const appt = (id, patient, name, prof, day, hour, status) => ({
  id, patient_id: patient, professional_id: prof, start_time: at(day, hour), status,
  class_price: 60, commission_amount: 24,
  patients: { full_name: name, status: 'ativo', profiles: { id: prof, full_name: prof } },
  profiles: { id: prof, full_name: prof },
  lesson_packages: { total_amount: 480, total_lessons: 8 },
});

const appointments = [
  appt('1', 'ana', 'Ana', 'erica', 3, 8, 'presenca_registrada'),
  appt('2', 'ana', 'Ana', 'erica', 5, 8, 'falta'),
  appt('3', 'ana', 'Ana', 'erica', 10, 8, 'reposicao'),
  appt('4', 'ana', 'Ana', 'erica', 10, 17, 'presenca_registrada'), // 2 no mesmo dia
  appt('5', 'ana', 'Ana', 'erica', 12, 8, 'agendada'),
  appt('6', 'ana', 'Ana', 'erica', 14, 8, 'ausencia_justificada'),
  appt('7', 'ana', 'Ana', 'erica', 17, 8, 'cancelada'),
  appt('8', 'bia', 'Bia', 'jaque', 3, 9, 'presenca_registrada'), // outra fisioterapeuta
  appt('9', 'bia', 'Bia', 'erica', 4, 9, 'presenca_registrada'), // paciente da outra, aula com a Erica
];

test('dias do mês', () => {
  assert.equal(monthDays('2026-11').length, 30);
  assert.equal(monthDays('2026-02').length, 28);
  assert.equal(monthDays('2028-02')[28], '2028-02-29');
});

test('grade da Erica: marcas, duas aulas no mesmo dia, pendentes e cancelada', () => {
  const grid = buildLaunchGrid({
    appointments, month: '2026-11', professionalId: 'erica',
    patients: [{ id: 'ana', full_name: 'Ana' }, { id: 'caio', full_name: 'Caio' }],
  });
  assert.deepEqual(grid.rows.map((row) => row.name), ['Ana', 'Bia', 'Caio']);
  const ana = grid.rows[0];
  assert.deepEqual(ana.cells['2026-11-10'].map((item) => item.mark), ['R', 'P']);
  assert.equal(ana.cells['2026-11-17'], undefined); // cancelada não aparece
  assert.deepEqual(ana.totals, { presences: 2, makeups: 1, absences: 1, paid: 4, pending: 1, excused: 1 });
  assert.equal(grid.rows[2].totals.paid, 0); // paciente sem aula aparece vazio
  assert.equal(grid.totals.paid, 5);
});

test('aulas pagas batem com a planilha de comissão', () => {
  const grid = buildLaunchGrid({ appointments, patients: [], month: '2026-11', professionalId: 'erica' });
  const detail = buildCommissionDetailReport(appointments, null, '2026-11-01', '2026-11-30', [])
    .filter((row) => row.professionalId === 'erica');
  const fromSheet = Object.fromEntries(detail.map((row) => [row.patientId, row.paidClasses]));
  const fromGrid = Object.fromEntries(grid.rows.map((row) => [row.patientId, row.totals.paid]));
  assert.deepEqual(fromGrid, fromSheet);
});

import { editableCell, nextCellMark, usualTime } from '../src/lib/launchGrid.js';

test('quais células a grade deixa editar', () => {
  const item = (mark, id = 'x') => ({ id, mark, status: '', time: '08:00', startTime: '' });
  assert.deepEqual(editableCell([], '2026-11-10', '2026-11-26'), { editable: true, baseMark: null });
  assert.equal(editableCell([], '2026-11-27', '2026-11-26').editable, false); // futuro
  assert.equal(editableCell([], '2026-11-26', '2026-11-26').editable, true); // hoje pode
  assert.deepEqual(editableCell([item('A', 'a1')], '2026-11-10', '2026-11-26'), { editable: true, baseMark: 'A', appointmentId: 'a1' });
  assert.equal(editableCell([item('R')], '2026-11-10', '2026-11-26').editable, false);
  assert.equal(editableCell([item('J')], '2026-11-10', '2026-11-26').editable, false);
  assert.equal(editableCell([item('P'), item('P', 'y')], '2026-11-10', '2026-11-26').editable, false);
});

test('ciclo de cliques', () => {
  assert.equal(nextCellMark(null, null), 'P');
  assert.equal(nextCellMark(null, 'P'), 'F');
  assert.equal(nextCellMark(null, 'F'), null);
  assert.equal(nextCellMark('A', 'A'), 'P');
  assert.equal(nextCellMark('A', 'F'), 'A');
  assert.equal(nextCellMark('P', 'P'), 'F');
  assert.equal(nextCellMark('P', 'F'), 'P');
  assert.equal(nextCellMark('F', 'F'), 'P');
});

test('horário mais comum do paciente', () => {
  const row = { cells: {
    '2026-11-02': [{ time: '08:00' }], '2026-11-04': [{ time: '08:00' }], '2026-11-06': [{ time: '17:00' }],
  } };
  assert.equal(usualTime(row), '08:00');
  assert.equal(usualTime({ cells: {} }), null);
});
