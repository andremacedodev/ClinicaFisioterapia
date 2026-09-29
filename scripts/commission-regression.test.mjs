import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommissionDetailReport, buildCommissionReport } from '../src/lib/commission.js';

// Presença e falta são aulas pagas; cancelada não entra.
test('presence and paid absence contribute to commission values; cancelled does not', () => {
  const appointments = [
    {
      id: '1',
      patient_id: 'p1',
      package_id: 'pkg1',
      start_time: '2026-07-01T10:00:00.000Z',
      status: 'presenca_registrada',
      class_price: 100,
      patients: null,
      profiles: { id: 'physio-1', full_name: 'Ana' },
      lesson_packages: {
        total_lessons: 4,
        lesson_value: 100,
        procedure_amount: 0,
        total_amount: 400,
      },
    },
    {
      id: '2',
      patient_id: 'p2',
      package_id: 'pkg2',
      start_time: '2026-07-02T10:00:00.000Z',
      status: 'falta',
      class_price: 100,
      patients: null,
      profiles: { id: 'physio-1', full_name: 'Ana' },
      lesson_packages: {
        total_lessons: 4,
        lesson_value: 100,
        procedure_amount: 0,
        total_amount: 400,
      },
    },
    {
      id: '3',
      patient_id: 'p3',
      package_id: 'pkg3',
      start_time: '2026-07-03T10:00:00.000Z',
      status: 'cancelada',
      class_price: 100,
      patients: null,
      profiles: { id: 'physio-1', full_name: 'Ana' },
      lesson_packages: {
        total_lessons: 4,
        lesson_value: 100,
        procedure_amount: 0,
        total_amount: 400,
      },
    },
  ];

  const report = buildCommissionReport(appointments, null);

  assert.equal(report.length, 1);
  assert.equal(report[0].heldClasses, 1);
  assert.equal(report[0].paidMisses, 1);
  assert.equal(report[0].gross, 200);
  assert.equal(report[0].professionalShare, 80);
});

const lesson = (id, day, status, patientId = 'p1') => ({
  id,
  patient_id: patientId,
  package_id: 'pkg1',
  start_time: `2026-07-${day}T12:00:00.000Z`,
  status,
  class_price: 100,
  commission_amount: null,
  patients: { full_name: 'Paciente 1', status: 'ativo' },
  profiles: { id: 'physio-1', full_name: 'Ana' },
  lesson_packages: { total_lessons: 8, lesson_value: 100, procedure_amount: 0, total_amount: 800 },
});

// Reposição é aula dada: conta como presença na produção e na comissão.
test('makeup lesson (reposicao) counts as a held class', () => {
  const report = buildCommissionReport(
    [lesson('1', '01', 'presenca_registrada'), lesson('2', '02', 'reposicao'), lesson('3', '03', 'falta'), lesson('4', '04', 'ausencia_justificada')],
    null,
    '2026-07-01',
    '2026-07-31',
  );

  assert.equal(report[0].heldClasses, 2);
  assert.equal(report[0].paidMisses, 1);
  assert.equal(report[0].gross, 300);
  assert.equal(report[0].professionalShare, 120);
});

test('makeup lesson appears as REPOSIÇÃO in the detailed spreadsheet rows', () => {
  const rows = buildCommissionDetailReport(
    [lesson('1', '01', 'presenca_registrada'), lesson('2', '02', 'reposicao'), lesson('3', '02', 'presenca_registrada'), lesson('4', '03', 'falta')],
    null,
    '2026-07-01',
    '2026-07-31',
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].attendanceByDate, {
    '2026-07-01': ['PRESENÇA'],
    '2026-07-02': ['REPOSIÇÃO', 'PRESENÇA'],
    '2026-07-03': ['FALTA'],
  });
  assert.equal(rows[0].paidClasses, 4);
  assert.equal(rows[0].grossTotal, 400);
  assert.equal(rows[0].totalCommission, 160);
});
