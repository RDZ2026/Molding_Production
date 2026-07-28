import { useState, useEffect } from 'react';
import { PRESSES, DEFAULT_GOALS } from './constants';

export function useIsDesktop() {
  const [v, setV] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const h = () => setV(window.innerWidth >= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return v;
}

export function todayStr() {
  const d = new Date(), y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, '0'),
    day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(val) {
  if (!val || val === 'undefined' || val === 'null') return '—';
  const s = String(val);
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const p = s.split('-');
    return `${mo[parseInt(p[1], 10) - 1]} ${parseInt(p[2], 10)}`;
  }
  try { const d = new Date(s); if (!isNaN(d.getTime())) return `${mo[d.getMonth()]} ${d.getDate()}`; } catch {}
  return s;
}

export function formatDateTime(ts) {
  if (!ts || ts === 'undefined') return '—';
  try {
    const d = new Date(ts); if (isNaN(d.getTime())) return ts;
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let h = d.getHours(), mins = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${mo[d.getMonth()]} ${d.getDate()} · ${h}:${mins} ${ampm}`;
  } catch { return ts; }
}

export function hitColor(h) { return h >= 90 ? '#1e7e34' : h >= 70 ? '#d6820a' : '#C8102E'; }
export function hitCls(h)   { return h >= 90 ? 'hit-good' : h >= 70 ? 'hit-warn' : 'hit-bad'; }

export function calcHit(good, goal) {
  const g = parseInt(good, 10), gl = parseInt(goal, 10);
  if (!gl || isNaN(g) || g === 0) return null;
  return Math.round((g / gl) * 100);
}

export function calcPressEH(p) {
  if (!p.isRunning || !p.partEhRate || !p.estimatedQty) return 0;
  const q = parseInt(p.estimatedQty, 10);
  return isNaN(q) || q <= 0 ? 0 : q * p.partEhRate;
}

export function calcActualEH(pressData) {
  return (pressData || []).reduce((sum, p) => {
    if (!p.isRunning || !p.partEhRate || !p.good) return sum;
    return sum + (parseInt(p.good, 10) || 0) * p.partEhRate;
  }, 0);
}

export function getDateRange(period) {
  const now = new Date(), dow = now.getDay(), back = dow === 0 ? 6 : dow - 1;
  if (period === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - back); mon.setHours(0, 0, 0, 0);
    return { startDate: mon.toISOString(), endDate: now.toISOString() };
  }
  if (period === 'lastWeek') {
    const tm = new Date(now); tm.setDate(now.getDate() - back); tm.setHours(0, 0, 0, 0);
    const lm = new Date(tm); lm.setDate(tm.getDate() - 7);
    const ls = new Date(tm); ls.setMilliseconds(-1);
    return { startDate: lm.toISOString(), endDate: ls.toISOString() };
  }
  if (period === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: s.toISOString(), endDate: now.toISOString() };
  }
  return { startDate: new Date(2020, 0, 1).toISOString(), endDate: now.toISOString() };
}

export function getMondayStr(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00'), dow = d.getDay(), back = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - back);
    return d.toISOString().split('T')[0];
  } catch { return dateStr; }
}

export function initPressData(goals, lastReport) {
  return PRESSES.map(p => {
    let opId = '', opName = '', opStamp = '', mold = '', partId = '', partNumber = '', partEhRate = 0;
    if (lastReport?.pressData) {
      const lp = lastReport.pressData.find(x => x.pressNumber === p);
      if (lp) {
        opId = lp.operatorId || ''; opName = lp.operatorName || ''; opStamp = lp.operatorStamp || '';
        mold = lp.moldNumber || ''; partId = lp.partId || ''; partNumber = lp.partNumber || '';
        partEhRate = lp.partEhRate || 0;
      }
    }
    return {
      pressNumber: p, operatorId: opId, operatorName: opName, operatorStamp: opStamp,
      good: '', scrap: '', goal: String(goals[p] != null ? goals[p] : 100),
      notes: '', hasIssue: false, isRunning: true, notRunningReason: '',
      moldNumber: mold, partId, partNumber, partEhRate, fromPrediction: false,
    };
  });
}

export function initEHPressData() {
  return PRESSES.map(p => ({
    pressNumber: p, partId: '', partNumber: '', partDescription: '',
    partEhRate: 0, estimatedQty: '', isRunning: true, notRunningReason: '',
  }));
}

export function generatePassdown(pressData) {
  let lines = 'Molding -\n  (Good / Scrap / Goal)';
  (pressData || []).forEach(p => {
    const g = p.isRunning ? parseInt(p.good || 0, 10) : 0;
    const sc = p.isRunning ? parseInt(p.scrap || 0, 10) : 0;
    const gl = parseInt(p.goal || 0, 10);
    let line = `${p.pressNumber} - ( ${g} / ${sc} / ${gl} )`;
    if (!p.isRunning && p.notRunningReason) line += ` ${p.notRunningReason.toLowerCase()}`;
    if (p.notes) line += ` — ${p.notes}`;
    lines += `\n\n${line}`;
  });
  return lines;
}

export function generateEHPassdown(pressData, totalEH, goalEH, date, username) {
  const pad = (s, n) => String(s).padEnd(n);
  let lines = `EH Prediction — ${formatDate(date)} — 2nd Shift\nSubmitted by: ${username}\n${'─'.repeat(50)}\n\n`;
  lines += `${pad('Press', 7)} ${pad('Part', 20)} ${pad('Est. Qty', 10)} Proj. EH\n${'─'.repeat(50)}\n`;
  (pressData || []).forEach(p => {
    if (!p.isRunning) {
      lines += `${pad(p.pressNumber, 7)} NOT RUNNING${p.notRunningReason ? ' — ' + p.notRunningReason : ''}\n`;
    } else {
      const eh = (p.partEhRate && p.estimatedQty)
        ? ((parseInt(p.estimatedQty) || 0) * p.partEhRate).toFixed(2) + 'h' : '—';
      lines += `${pad(p.pressNumber, 7)} ${pad(p.partNumber || '(no part)', 20)} ${pad(p.estimatedQty || '0', 10)} ${eh}\n`;
    }
  });
  const pct = goalEH > 0 ? Math.round((totalEH / goalEH) * 100) : 0;
  lines += `\n${'─'.repeat(50)}\nTotal Projected EH : ${totalEH.toFixed(2)}h\nGoal (2nd Shift)   : ${goalEH}h\nStatus             : ${totalEH >= goalEH ? '✓ ON TRACK' : `⚠ BELOW GOAL (${pct}%)`}\n`;
  return lines;
}

export function calcMolderStats(opName, reports) {
  const nightMap = {}, pressMap = {}, weekMap = {};
  reports.forEach(r => {
    let nG = 0, nGl = 0, hi = false;
    (r.pressData || []).forEach(p => {
      if (p.operatorName !== opName || !p.isRunning) return;
      const g = parseInt(p.good || 0, 10), gl = parseInt(p.goal || 0, 10);
      if (!gl) return;
      nG += g; nGl += gl; if (p.hasIssue) hi = true;
      if (!pressMap[p.pressNumber]) pressMap[p.pressNumber] = { good: 0, goal: 0, nights: 0, molds: [] };
      pressMap[p.pressNumber].good += g; pressMap[p.pressNumber].goal += gl;
      pressMap[p.pressNumber].nights++;
      if (p.moldNumber) pressMap[p.pressNumber].molds.push(p.moldNumber);
    });
    if (nGl > 0) {
      nightMap[r.date] = { good: nG, goal: nGl, hit: Math.round((nG / nGl) * 100), hasIssue: hi };
      const wk = getMondayStr(r.date);
      if (!weekMap[wk]) weekMap[wk] = { good: 0, goal: 0, nights: 0 };
      weekMap[wk].good += nG; weekMap[wk].goal += nGl; weekMap[wk].nights++;
    }
  });
  const nights = Object.entries(nightMap).map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const tG = nights.reduce((s, n) => s + n.good, 0);
  const tGl = nights.reduce((s, n) => s + n.goal, 0);
  const avgHit = tGl > 0 ? Math.round((tG / tGl) * 100) : null;
  const issueRate = nights.length > 0 ? Math.round((nights.filter(n => n.hasIssue).length / nights.length) * 100) : 0;
  const pressBreakdown = Object.entries(pressMap)
    .map(([press, d]) => ({ press, hit: Math.round((d.good / d.goal) * 100), nights: d.nights, latestMold: d.molds[d.molds.length - 1] || '' }))
    .sort((a, b) => b.hit - a.hit);
  const weeklySummary = Object.entries(weekMap)
    .map(([week, d]) => ({ week, hit: Math.round((d.good / d.goal) * 100), good: d.good, goal: d.goal, nights: d.nights }))
    .sort((a, b) => b.week.localeCompare(a.week));
  const last3 = nights.slice(-3);
  return {
    nights, avgHit, issueRate, pressBreakdown, weeklySummary, totalNights: nights.length,
    isOnFire: last3.length >= 3 && last3.every(n => n.hit >= 95),
    isConcern: avgHit !== null && avgHit < 75,
  };
}

export function getMolderWeekStatus(opName, reports) {
  let tG = 0, tGl = 0;
  const nights = [];
  reports.forEach(r => {
    let nG = 0, nGl = 0, hi = false;
    (r.pressData || []).forEach(p => {
      if (p.operatorName !== opName || !p.isRunning) return;
      const g = parseInt(p.good || 0, 10), gl = parseInt(p.goal || 0, 10);
      nG += g; nGl += gl; if (p.hasIssue) hi = true;
    });
    if (nGl > 0) { tG += nG; tGl += nGl; nights.push({ date: r.date, hit: Math.round((nG / nGl) * 100), hasIssue: hi }); }
  });
  nights.sort((a, b) => a.date.localeCompare(b.date));
  const weekAvg = tGl > 0 ? Math.round((tG / tGl) * 100) : null;
  const last3 = nights.slice(-3);
  return { weekAvg, isConcern: weekAvg !== null && weekAvg < 75, isOnFire: last3.length >= 3 && last3.every(n => n.hit >= 95), nightCount: nights.length };
}
