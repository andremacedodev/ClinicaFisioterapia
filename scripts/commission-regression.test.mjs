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

// ── Comissão configurável ────────────────────────────────────────────────────
function makeAppointment(id, startTime, extra = {}) {
  return {
    id,
    patient_id: 'p1',
    package_id: 'pkg1',
    start_time: startTime,
    status: 'presenca_registrada',
    class_price: 100,
    patients: null,
    profiles: { id: 'physio-1', full_name: 'Ana' },
    lesson_packages: null,
    ...extra,
  };
}

test('without rules the commission stays at 40%', () => {
  const report = buildCommissionReport([makeAppointment('1', '2026-07-10T12:00:00Z')], null);
  assert.equal(report[0].professionalShare, 40);
});

test('a rule change only affects classes after the moment it was made', () => {
  const rules = [
    { professional_id: 'physio-1', commission_type: 'percent', commission_value: 40, valid_from: '1900-01-01T00:00:00Z' },
    { professional_id: 'physio-1', commission_type: 'fixed', commission_value: 25, valid_from: '2026-07-15T09:30:00Z' },
  ];
  const appointments = [
    makeAppointment('before', '2026-07-10T12:00:00Z'),
    makeAppointment('after', '2026-07-20T12:00:00Z'),
  ];
  const report = buildCommissionReport(appointments, null, undefined, undefined, rules);
  assert.equal(report[0].professionalShare, 40 + 25);

  const detail = buildCommissionDetailReport(appointments, null, '2026-07-01', '2026-07-31', rules);
  assert.equal(detail[0].totalCommission, 65);
});

test('percentage rules use the class value; other professionals keep their own rule', () => {
  const rules = [
    { professional_id: 'physio-1', commission_type: 'percent', commission_value: 50, valid_from: '1900-01-01T00:00:00Z' },
    { professional_id: 'physio-2', commission_type: 'percent', commission_value: 30, valid_from: '1900-01-01T00:00:00Z' },
  ];
  const appointments = [
    makeAppointment('a', '2026-07-10T12:00:00Z'),
    makeAppointment('b', '2026-07-10T13:00:00Z', { profiles: { id: 'physio-2', full_name: 'Bia' } }),
  ];
  const report = buildCommissionReport(appointments, null, undefined, undefined, rules);
  assert.deepEqual(
    report.map((item) => [item.professionalName, item.professionalShare]),
    [['Ana', 50], ['Bia', 30]],
  );
});

test('commission saved on the class wins over the rule', () => {
  const rules = [
    { professional_id: 'physio-1', commission_type: 'fixed', commission_value: 25, valid_from: '1900-01-01T00:00:00Z' },
  ];
  const report = buildCommissionReport(
    [makeAppointment('1', '2026-07-10T12:00:00Z', { commission_amount: 33 })],
    null, undefined, undefined, rules,
  );
  assert.equal(report[0].professionalShare, 33);
});

test('two changes at the same moment: the latest created wins', () => {
  const rules = [
    { professional_id: 'physio-1', commission_type: 'percent', commission_value: 40, valid_from: '2026-07-01T00:00:00Z', created_at: '2026-07-01T00:00:00Z' },
    { professional_id: 'physio-1', commission_type: 'percent', commission_value: 45, valid_from: '2026-07-01T00:00:00Z', created_at: '2026-07-01T00:00:05Z' },
  ];
  const report = buildCommissionReport([makeAppointment('1', '2026-07-10T12:00:00Z')], null, undefined, undefined, rules);
  assert.equal(report[0].professionalShare, 45);
});

// Troca de fisioterapeuta responsável: aulas já dadas ficam com quem era a
// responsável na data (commission_professional_id gravado pelo banco); as
// seguintes vão para a responsável atual do paciente.
test('after a transfer, past classes keep the previous responsible and new ones go to the new one', () => {
  const rules = [
    { professional_id: 'antiga', commission_type: 'percent', commission_value: 40, valid_from: '1900-01-01T00:00:00Z' },
    { professional_id: 'nova', commission_type: 'fixed', commission_value: 30, valid_from: '1900-01-01T00:00:00Z' },
  ];
  const patient = { full_name: 'Paciente', status: 'ativo', profiles: { id: 'nova', full_name: 'Nova' } };
  const before = {
    ...makeAppointment('1', '2026-11-20T12:00:00Z'),
    patients: patient,
    commission_professional_id: 'antiga',
    commission_professional: { id: 'antiga', full_name: 'Antiga' },
  };
  const after = { ...makeAppointment('2', '2026-11-27T12:00:00Z'), patients: patient };

  const report = buildCommissionReport([before, after], null, undefined, undefined, rules);
  const byId = Object.fromEntries(report.map((item) => [item.professionalId, item]));

  assert.equal(byId.antiga.professionalName, 'Antiga');
  assert.equal(byId.antiga.heldClasses, 1);
  assert.equal(byId.antiga.professionalShare, 40); // 40% de 100, regra da antiga
  assert.equal(byId.nova.heldClasses, 1);
  assert.equal(byId.nova.professionalShare, 30); // valor fixo da nova

  const detail = buildCommissionDetailReport([before, after], null, '2026-11-01', '2026-11-30', rules);
  assert.deepEqual(detail.map((row) => row.professionalId).sort(), ['antiga', 'nova']);
});

test('without the recorded field the commission follows the current responsible (old behaviour)', () => {
  const appointment = {
    ...makeAppointment('1', '2026-11-20T12:00:00Z'),
    patients: { full_name: 'Paciente', status: 'ativo', profiles: { id: 'nova', full_name: 'Nova' } },
  };
  const report = buildCommissionReport([appointment], null);
  assert.equal(report.length, 1);
  assert.equal(report[0].professionalId, 'nova');
});
