import React, { useState, useEffect, useCallback } from 'react';
import { gasCall } from '../api.js';

// Press rotation ring — order determines rotation sequence
const ROTATION_RING = [452, 454, 462, 455, 300, 501, 502, 1000, 1200];

// Paired presses: maps secondary ring position -> primary ring position.
// Secondary always mirrors primary — one operator covers both.
//   pos 1 (454) + pos 2 (462)
//   pos 3 (455) + pos 4 (300)
//   pos 5 (501) + pos 6 (502)
const PRESS_PAIRS = { 2: 1, 4: 3, 6: 5 };

// Display rows — 6 effective rows instead of 9
const PAIRED_DISPLAY_ROWS = [
  { label: 'Press 452',       presses: [452],      ringPositions: [0] },
  { label: 'Press 454 / 462', presses: [454, 462], ringPositions: [1, 2] },
  { label: 'Press 455 / 300', presses: [455, 300], ringPositions: [3, 4] },
  { label: 'Press 501 / 502', presses: [501, 502], ringPositions: [5, 6] },
  { label: 'Press 1000',      presses: [1000],     ringPositions: [7] },
  { label: 'Press 1200',      presses: [1200],     ringPositions: [8] },
];

// Primary ring positions (one per display row — secondary mirrors primary)
const PRIMARY_POSITIONS = [0, 1, 3, 5, 7, 8];

// 6 distinct colors, one per display row
const POSITION_COLORS = [
  '#c0392b','#2980b9','#27ae60','#d35400','#8e44ad','#16a085'
];

// ── Helpers ────────────────────────────────────────────────────────────────

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isWeekday(d) {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function getWorkdaysInMonth(year, month) {
  const days = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (isWeekday(d)) days.push(toDateStr(new Date(d)));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function countWorkdaysBetween(startStr, endStr) {
  const start = parseLocalDate(startStr);
  const end   = parseLocalDate(endStr);
  if (end <= start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    if (isWeekday(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function computeAssignment(dateStr, settings) {
  if (!settings || !settings.baseDate || !settings.baseAssignment || settings.baseAssignment.length !== 9) {
    return ROTATION_RING.map(press => ({ press, operatorId: null }));
  }
  const workdays = countWorkdaysBetween(settings.baseDate, dateStr);
  const R   = Math.floor(workdays / (settings.frequency || 1));
  const dir = settings.direction || 1;

  return ROTATION_RING.map((press, ringPos) => {
    // Secondary positions always mirror their primary pair
    const effectivePos = PRESS_PAIRS[ringPos] !== undefined ? PRESS_PAIRS[ringPos] : ringPos;
    const idx = ((effectivePos - R * dir) % 9 + 9) % 9;
    return { press, operatorId: settings.baseAssignment[idx] };
  });
}

function formatMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shortDay(dateStr) {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

// Color index by primary ring position
function colorForPrimary(primaryRingPos) {
  const idx = PRIMARY_POSITIONS.indexOf(primaryRingPos);
  return idx >= 0 ? POSITION_COLORS[idx] : '#999';
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function RotationView({ user }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [settings, setSettings]   = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [dayModal, setDayModal]         = useState(null);
  const [saving, setSaving]             = useState(false);

  const shift   = user?.shift ? parseInt(user.shift) : 2;
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const opMap = {};
  operators.forEach(op => { opMap[op.id] = op; });

  // ── Data loading ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const firstDay = `${year}-${String(month + 1).padStart(2,'0')}-01`;
      const lastDay  = toDateStr(new Date(year, month + 1, 0));

      const [settingsRes, overridesRes, opsRes] = await Promise.allSettled([
        gasCall('getRotationSettings', { shift }),
        gasCall('getRotationOverrides', { shift, startDate: firstDay, endDate: lastDay }),
        gasCall('getOperators', { shift: null })
      ]);

      if (settingsRes.status === 'fulfilled' && settingsRes.value.success) {
        setSettings(settingsRes.value.settings);
      }
      if (overridesRes.status === 'fulfilled' && overridesRes.value.success) {
        setOverrides(overridesRes.value.overrides || []);
      }
      if (opsRes.status === 'fulfilled' && opsRes.value.success) {
        setOperators(opsRes.value.operators || []);
      }
    } catch {
      setError('Failed to load rotation data.');
    } finally {
      setLoading(false);
    }
  }, [year, month, shift]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived calendar ──────────────────────────────────────────────────

  const workdays = getWorkdaysInMonth(year, month);

  const calendar = {};
  workdays.forEach(dateStr => {
    const base            = computeAssignment(dateStr, settings);
    const ov              = overrides.find(o => o.date === dateStr);
    const callouts        = ov ? (ov.callouts || []) : [];
    const manualOverrides = ov ? (ov.manualOverrides || {}) : {};

    calendar[dateStr] = base.map((cell, ringPos) => {
      // Manual override on primary propagates to secondary
      const primaryPos = PRESS_PAIRS[ringPos] !== undefined ? PRESS_PAIRS[ringPos] : ringPos;
      if (manualOverrides[primaryPos] !== undefined) {
        return { ...cell, operatorId: manualOverrides[primaryPos], isManual: true };
      }
      if (manualOverrides[ringPos] !== undefined) {
        return { ...cell, operatorId: manualOverrides[ringPos], isManual: true };
      }
      const isCallout = callouts.includes(cell.operatorId);
      return { ...cell, operatorId: isCallout ? null : cell.operatorId, isCallout };
    });
  });

  // ── Month navigation ──────────────────────────────────────────────────

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // ── Override helpers ──────────────────────────────────────────────────

  function getOverride(dateStr) {
    return overrides.find(o => o.date === dateStr) || { date: dateStr, callouts: [], manualOverrides: {} };
  }

  async function saveOverride(dateStr, callouts, manualOverrides) {
    setSaving(true);
    try {
      await gasCall('saveRotationOverride', { shift, date: dateStr, callouts, manualOverrides });
      setOverrides(prev => {
        const without = prev.filter(o => o.date !== dateStr);
        return [...without, { date: dateStr, shift, callouts, manualOverrides }];
      });
    } catch {
      alert('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── PDF Export ────────────────────────────────────────────────────────

  function exportPDF() {
    const monthLabel = formatMonthLabel(year, month);
    const shiftLabel = shift === 1 ? '1st Shift' : '2nd Shift';

    let tableHead = '<tr><th>Press</th>';
    workdays.forEach(d => { tableHead += `<th>${shortDay(d)}</th>`; });
    tableHead += '</tr>';

    let tableBody = '';
    PAIRED_DISPLAY_ROWS.forEach(row => {
      const primaryPos = row.ringPositions[0];
      const isPaired   = row.ringPositions.length > 1;
      tableBody += `<tr><td class="press-col">${row.label}${isPaired ? '<br><span class="paired-note">1 operator</span>' : ''}</td>`;
      workdays.forEach(dateStr => {
        const cell = calendar[dateStr]?.[primaryPos];
        const op   = cell && cell.operatorId ? opMap[cell.operatorId] : null;
        const name = op ? op.name.split(' ')[0] : (cell?.isCallout ? 'CALLOUT' : '');
        const cls  = cell?.isCallout ? 'callout' : cell?.isManual ? 'manual' : '';
        tableBody += `<td class="${cls}">${name}</td>`;
      });
      tableBody += '</tr>';
    });

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Rotation — ${monthLabel}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 9px; margin: 0.4in; color: #000; }
  h2 { font-size: 13px; margin: 0 0 4px; }
  p  { font-size: 10px; margin: 0 0 8px; color: #444; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 3px 4px; text-align: center; white-space: nowrap; }
  th { background: #333; color: #fff; font-size: 8px; }
  .press-col { text-align: left; font-weight: bold; background: #eee; }
  .paired-note { font-size: 7px; font-weight: normal; color: #888; }
  .callout { color: #aaa; font-style: italic; }
  .manual  { font-weight: bold; }
  @media print { @page { size: landscape; margin: 0.4in; } }
</style>
</head>
<body>
<h2>nVent Hoffman — Operator Rotation Schedule</h2>
<p>${monthLabel} &nbsp;|&nbsp; ${shiftLabel} &nbsp;|&nbsp; Paired: 454/462 · 455/300 · 501/502</p>
<table>
<thead>${tableHead}</thead>
<tbody>${tableBody}</tbody>
</table>
<p style="margin-top:8px;font-size:8px;color:#666;">
  Bold = manual override &nbsp;|&nbsp; Italic gray = callout (absent) &nbsp;|&nbsp; Paired presses share one operator
  ${settings ? ` &nbsp;|&nbsp; Rotates every ${settings.frequency} workday${settings.frequency > 1 ? 's' : ''}, ${settings.direction === 1 ? 'clockwise' : 'counter-clockwise'}` : ''}
</p>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Loading rotation schedule...</div>;
  if (error)   return <div style={{ padding: 24, color: '#c0392b' }}>{error}</div>;

  return (
    <div style={{ padding: '16px 8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={prevMonth} style={navBtnStyle}>&#8592;</button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{formatMonthLabel(year, month)}</span>
          <button onClick={nextMonth} style={navBtnStyle}>&#8594;</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportPDF} style={secondaryBtnStyle}>Export PDF</button>
          {canEdit && (
            <button onClick={() => setShowSettings(true)} style={primaryBtnStyle}>
              {settings ? 'Edit Settings' : 'Set Up Rotation'}
            </button>
          )}
        </div>
      </div>

      {/* Paired press note */}
      <div style={{ fontSize: 12, color: '#666', background: '#f5f5f5', borderRadius: 6, padding: '6px 12px', marginBottom: 12 }}>
        Paired presses share one operator when understaffed: <strong>454/462 &nbsp;·&nbsp; 455/300 &nbsp;·&nbsp; 501/502</strong>
      </div>

      {/* No settings state */}
      {!settings && (
        <div style={{ padding: 32, textAlign: 'center', color: '#888', background: '#f9f9f9', borderRadius: 8 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Rotation not set up yet</div>
          {canEdit
            ? <div>Click <strong>Set Up Rotation</strong> to configure the starting assignment.</div>
            : <div>Ask your admin or manager to configure the rotation.</div>
          }
        </div>
      )}

      {/* Calendar grid — 6 rows (pairs collapsed) */}
      {settings && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 600, width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={headerCellStyle('#333')}>Press</th>
                {workdays.map(dateStr => {
                  const isToday = dateStr === toDateStr(new Date());
                  return (
                    <th key={dateStr}
                      style={{ ...headerCellStyle(isToday ? '#9b1c1c' : '#333'), cursor: canEdit ? 'pointer' : 'default' }}
                      onClick={() => canEdit && setDayModal(dateStr)}
                      title={canEdit ? 'Click to mark callouts / overrides' : ''}
                    >
                      {shortDay(dateStr)}
                      {canEdit && <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.75 }}>tap to edit</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PAIRED_DISPLAY_ROWS.map((row, rowIdx) => {
                const primaryPos = row.ringPositions[0];
                const isPaired   = row.ringPositions.length > 1;
                const color      = POSITION_COLORS[rowIdx];
                return (
                  <tr key={row.label}>
                    <td style={pressCellStyle}>
                      <strong>{row.label}</strong>
                      {isPaired && (
                        <span style={{ display: 'block', fontSize: 10, color: '#e67e22', fontWeight: 'normal' }}>
                          1 operator covers both
                        </span>
                      )}
                    </td>
                    {workdays.map(dateStr => {
                      const cell = calendar[dateStr]?.[primaryPos];
                      const op   = cell?.operatorId ? opMap[cell.operatorId] : null;
                      const bgColor   = op ? color : (cell?.isCallout ? '#f0f0f0' : '#fafafa');
                      const textColor = op ? '#fff' : '#bbb';
                      return (
                        <td key={dateStr} style={{
                          ...dataCellStyle,
                          background: bgColor,
                          color: textColor,
                          cursor: canEdit ? 'pointer' : 'default',
                          border: cell?.isManual ? '2px solid #000' : '1px solid #ddd',
                        }}
                          onClick={() => canEdit && setDayModal(dateStr)}
                          title={op ? `${op.name}${cell.isManual ? ' (manual)' : ''}${isPaired ? ' — covers both presses' : ''}` : cell?.isCallout ? 'Callout' : ''}
                        >
                          {op ? op.name.split(' ')[0] : (cell?.isCallout ? <em style={{ fontSize: 10, color: '#aaa' }}>OUT</em> : '')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
            Bold border = manual override &nbsp;·&nbsp; OUT = callout/absent
            {canEdit && <span> &nbsp;·&nbsp; Tap any column header or cell to edit that day</span>}
          </div>
        </div>
      )}

      {/* Legend */}
      {settings && operators.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PAIRED_DISPLAY_ROWS.map((row, rowIdx) => {
            const primaryPos   = row.ringPositions[0];
            const todayStr     = toDateStr(new Date());
            const assignment   = calendar[todayStr]?.[primaryPos] || calendar[workdays[0]]?.[primaryPos];
            const op = assignment?.operatorId ? opMap[assignment.operatorId] : null;
            return (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: POSITION_COLORS[rowIdx] }} />
                <span style={{ color: '#666' }}>{row.label}</span>
                {op && <span style={{ color: '#333' }}>— {op.name}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          operators={operators}
          shift={shift}
          onSave={async (newSettings) => {
            setSaving(true);
            try {
              await gasCall('saveRotationSettings', { ...newSettings, shift });
              setSettings(newSettings);
              setShowSettings(false);
            } catch {
              alert('Failed to save settings.');
            } finally {
              setSaving(false);
            }
          }}
          onClose={() => setShowSettings(false)}
          saving={saving}
        />
      )}

      {/* Day override modal */}
      {dayModal && (
        <DayModal
          dateStr={dayModal}
          override={getOverride(dayModal)}
          assignment={calendar[dayModal] || []}
          operators={operators}
          opMap={opMap}
          onSave={async (callouts, manualOverrides) => {
            await saveOverride(dayModal, callouts, manualOverrides);
            setDayModal(null);
          }}
          onClose={() => setDayModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── Settings Modal ──────────────────────────────────────────────────────────

function SettingsModal({ settings, operators, shift, onSave, onClose, saving }) {
  const initAssignment = settings?.baseAssignment?.length === 9
    ? [...settings.baseAssignment]
    : Array(9).fill('');

  const [baseDate,       setBaseDate]       = useState(settings?.baseDate || toDateStr(new Date()));
  const [baseAssignment, setBaseAssignment] = useState(initAssignment);
  const [frequency,      setFrequency]      = useState(settings?.frequency || 1);
  const [direction,      setDirection]      = useState(settings?.direction ?? 1);

  function setOp(primaryPos, opId) {
    setBaseAssignment(prev => {
      const next = [...prev];
      next[primaryPos] = opId;
      // Find if this primary has a secondary pair and mirror it
      Object.entries(PRESS_PAIRS).forEach(([sec, pri]) => {
        if (parseInt(pri) === primaryPos) next[parseInt(sec)] = opId;
      });
      return next;
    });
  }

  function handleSave() {
    if (PRIMARY_POSITIONS.some(pos => !baseAssignment[pos])) {
      alert('Assign an operator to every press before saving.');
      return;
    }
    // Ensure secondary positions mirror primary before saving
    const final = [...baseAssignment];
    Object.entries(PRESS_PAIRS).forEach(([sec, pri]) => {
      final[parseInt(sec)] = final[parseInt(pri)];
    });
    onSave({ baseDate, baseAssignment: final, frequency: parseInt(frequency), direction: parseInt(direction) });
  }

  // Only count primary positions for duplicate detection
  const usedIds = PRIMARY_POSITIONS.map(pos => baseAssignment[pos]).filter(Boolean);

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Rotation Settings</h3>

        <label style={labelStyle}>Starting date (first day of this assignment)</label>
        <input type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} style={inputStyle} />

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Rotate every (workdays)</label>
            <input type="number" min={1} max={30} value={frequency}
              onChange={e => setFrequency(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Direction</label>
            <select value={direction} onChange={e => setDirection(e.target.value)} style={inputStyle}>
              <option value={1}>Clockwise (452→454/462→455/300→...)</option>
              <option value={-1}>Counter-clockwise (452→1200→1000→...)</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ ...labelStyle, display: 'block', marginBottom: 8 }}>
            Starting assignment on {baseDate}
          </label>
          {PAIRED_DISPLAY_ROWS.map((row, rowIdx) => {
            const primaryPos = row.ringPositions[0];
            const isPaired   = row.ringPositions.length > 1;
            const selected   = baseAssignment[primaryPos];
            return (
              <div key={row.label} style={{ marginBottom: isPaired ? 10 : 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: POSITION_COLORS[rowIdx], flexShrink: 0 }} />
                  <span style={{ width: 120, fontSize: 13, fontWeight: 600 }}>{row.label}</span>
                  <select value={selected} onChange={e => setOp(primaryPos, e.target.value)}
                    style={{ ...inputStyle, flex: 1, margin: 0 }}>
                    <option value="">— Select operator —</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}
                        disabled={usedIds.includes(op.id) && op.id !== selected}>
                        {op.name}{usedIds.includes(op.id) && op.id !== selected ? ' (assigned)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {isPaired && (
                  <div style={{ marginLeft: 114, fontSize: 11, color: '#e67e22', marginTop: 2 }}>
                    One operator runs both presses
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtnStyle} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={primaryBtnStyle} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Day Override Modal ──────────────────────────────────────────────────────

function DayModal({ dateStr, override, assignment, operators, opMap, onSave, onClose, saving }) {
  const [callouts,        setCallouts]        = useState(override.callouts || []);
  const [manualOverrides, setManualOverrides] = useState(override.manualOverrides || {});

  const d = parseLocalDate(dateStr);
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  function toggleCallout(opId) {
    setCallouts(prev =>
      prev.includes(opId) ? prev.filter(id => id !== opId) : [...prev, opId]
    );
  }

  function setManual(primaryPos, opId) {
    setManualOverrides(prev => {
      const next = { ...prev };
      if (opId === '') {
        delete next[primaryPos];
        // Also clear secondary if set
        Object.entries(PRESS_PAIRS).forEach(([sec, pri]) => {
          if (parseInt(pri) === primaryPos) delete next[parseInt(sec)];
        });
      } else {
        next[primaryPos] = opId;
        // Mirror to secondary
        Object.entries(PRESS_PAIRS).forEach(([sec, pri]) => {
          if (parseInt(pri) === primaryPos) next[parseInt(sec)] = opId;
        });
      }
      return next;
    });
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{dayLabel}</h3>
        <p style={{ margin: '0 0 16px', color: '#888', fontSize: 13 }}>Mark callouts or override a press assignment</p>

        {/* Callout section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#333' }}>Callouts (absent tonight)</div>
          {operators.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>No operators loaded</div>}
          {operators.map(op => (
            <label key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={callouts.includes(op.id)} onChange={() => toggleCallout(op.id)} />
              <span style={{ fontSize: 13 }}>{op.name}</span>
            </label>
          ))}
        </div>

        {/* Manual overrides — 6 rows */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#333' }}>Manual press assignment (optional)</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Overrides rotation for this day only. Leave blank to use rotation.</div>
          {PAIRED_DISPLAY_ROWS.map((row, rowIdx) => {
            const primaryPos  = row.ringPositions[0];
            const isPaired    = row.ringPositions.length > 1;
            const computed    = assignment[primaryPos];
            const computedOp  = computed?.operatorId ? opMap[computed.operatorId] : null;
            return (
              <div key={row.label} style={{ marginBottom: isPaired ? 10 : 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: POSITION_COLORS[rowIdx], flexShrink: 0 }} />
                  <span style={{ width: 120, fontSize: 13, fontWeight: 600 }}>{row.label}</span>
                  <select
                    value={manualOverrides[primaryPos] !== undefined ? manualOverrides[primaryPos] : ''}
                    onChange={e => setManual(primaryPos, e.target.value)}
                    style={{ ...inputStyle, flex: 1, margin: 0, fontSize: 12 }}
                  >
                    <option value="">Auto ({computedOp ? computedOp.name : 'empty'})</option>
                    <option value="null">Empty (no one)</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </div>
                {isPaired && (
                  <div style={{ marginLeft: 114, fontSize: 11, color: '#e67e22', marginTop: 2 }}>
                    Applies to both presses
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtnStyle} disabled={saving}>Cancel</button>
          <button
            onClick={() => onSave(callouts, manualOverrides)}
            style={primaryBtnStyle}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ───────────────────────────────────────────────────────────

const navBtnStyle = {
  background: 'none', border: '1px solid #ddd', borderRadius: 4,
  padding: '4px 10px', cursor: 'pointer', fontSize: 16, lineHeight: 1
};
const primaryBtnStyle = {
  background: '#c0002a', color: '#fff', border: 'none',
  borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13
};
const secondaryBtnStyle = {
  background: '#fff', color: '#333', border: '1px solid #ccc',
  borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13
};
const headerCellStyle = (bg) => ({
  background: bg, color: '#fff', padding: '6px 8px',
  fontSize: 11, fontWeight: 600, textAlign: 'center',
  border: '1px solid #555', whiteSpace: 'nowrap', minWidth: 70
});
const pressCellStyle = {
  padding: '6px 10px', background: '#f5f5f5', fontWeight: 600,
  fontSize: 12, border: '1px solid #ddd', whiteSpace: 'nowrap'
};
const dataCellStyle = {
  padding: '5px 4px', textAlign: 'center', fontSize: 12,
  minWidth: 64, maxWidth: 90, overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'opacity .1s'
};
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
};
const modalStyle = {
  background: '#fff', borderRadius: 10, padding: 24,
  width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 };
const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #ccc',
  borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginBottom: 4
};
