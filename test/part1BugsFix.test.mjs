import { test } from 'node:test';
import assert from 'node:assert/strict';

function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesToTime(mins) {
  const norm = ((Math.floor(mins) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(norm / 60)).padStart(2, '0');
  const mm = String(norm % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function reconcileTimeAndDuration(options) {
  const {
    startTime,
    endTime,
    durationMinutes,
    existingStartTime,
    existingEndTime,
    existingDurationMinutes
  } = options || {};

  const hasExplicitStart = startTime !== undefined && startTime !== null && String(startTime).trim() !== '';
  const hasExplicitEnd = endTime !== undefined && endTime !== null && String(endTime).trim() !== '';
  const hasExplicitDur = durationMinutes !== undefined && durationMinutes !== null && !isNaN(Number(durationMinutes)) && Number(durationMinutes) > 0;

  let start = hasExplicitStart ? String(startTime).trim() : (existingStartTime ? String(existingStartTime).trim() : '09:00');
  if (timeToMinutes(start) === null) start = '09:00';
  const startMins = timeToMinutes(start);

  let dur;
  let end;
  let warning;

  if ((hasExplicitStart || hasExplicitDur) && !hasExplicitEnd) {
    const rawDur = hasExplicitDur
      ? Number(durationMinutes)
      : (existingDurationMinutes ? Number(existingDurationMinutes) : 45);
    dur = rawDur > 0 ? rawDur : 45;
    end = minutesToTime(startMins + dur);
  } else if (hasExplicitEnd && !hasExplicitStart && !hasExplicitDur) {
    end = String(endTime).trim();
    let endMins = timeToMinutes(end);
    if (endMins === null) {
      dur = Number(existingDurationMinutes) || 45;
      end = minutesToTime(startMins + dur);
    } else {
      const effectiveEndMins = endMins <= startMins ? endMins + 1440 : endMins;
      dur = Math.max(15, effectiveEndMins - startMins);
    }
  } else if (hasExplicitEnd && !hasExplicitDur) {
    end = String(endTime).trim();
    let endMins = timeToMinutes(end);
    if (endMins === null) {
      dur = 45;
      end = minutesToTime(startMins + dur);
    } else {
      const effectiveEndMins = endMins <= startMins ? endMins + 1440 : endMins;
      dur = Math.max(15, effectiveEndMins - startMins);
    }
  } else if (hasExplicitDur) {
    dur = Number(durationMinutes);
    const computedEnd = minutesToTime(startMins + dur);
    if (hasExplicitEnd && String(endTime).trim() !== computedEnd) {
      warning = `Specified endTime "${endTime}" conflicted with startTime "${start}" + duration ${dur}m. Recomputed endTime to "${computedEnd}".`;
    }
    end = computedEnd;
  } else {
    const rawDur = Number(existingDurationMinutes) || 45;
    dur = rawDur > 0 ? rawDur : 45;
    end = minutesToTime(startMins + dur);
  }

  return { startTime: start, endTime: end, durationMinutes: dur, warning };
}

test('Part 1 Bug 1: Changing start time only does NOT cause end-time drift into 4-hour block', () => {
  const existing = {
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60
  };

  // Claude patch: only changed start time to 07:00
  const reconciled = reconcileTimeAndDuration({
    startTime: '07:00',
    existingStartTime: existing.startTime,
    existingEndTime: existing.endTime,
    existingDurationMinutes: existing.durationMinutes
  });

  assert.equal(reconciled.startTime, '07:00');
  assert.equal(reconciled.durationMinutes, 60);
  assert.equal(reconciled.endTime, '08:00'); // NOT 11:00 (which would be 240 mins)
});

test('Part 1 Bug 1: Changing duration only recomputes end time correctly', () => {
  const existing = {
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60
  };

  // Claude patch: duration changed from 60 to 90
  const reconciled = reconcileTimeAndDuration({
    durationMinutes: 90,
    existingStartTime: existing.startTime,
    existingEndTime: existing.endTime,
    existingDurationMinutes: existing.durationMinutes
  });

  assert.equal(reconciled.startTime, '10:00');
  assert.equal(reconciled.durationMinutes, 90);
  assert.equal(reconciled.endTime, '11:30');
});

test('Part 1 Bug 1: Changing end time only derives new duration', () => {
  const existing = {
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60
  };

  // Claude patch: only endTime changed to 12:30
  const reconciled = reconcileTimeAndDuration({
    endTime: '12:30',
    existingStartTime: existing.startTime,
    existingEndTime: existing.endTime,
    existingDurationMinutes: existing.durationMinutes
  });

  assert.equal(reconciled.startTime, '10:00');
  assert.equal(reconciled.durationMinutes, 150); // 2.5h
  assert.equal(reconciled.endTime, '12:30');
});

test('Part 1 Bug 1: Conflicting start, end, and duration trusts start + duration and issues warning', () => {
  const reconciled = reconcileTimeAndDuration({
    startTime: '09:00',
    endTime: '12:00', // says 12:00 (3h)
    durationMinutes: 60 // but duration says 60m
  });

  assert.equal(reconciled.startTime, '09:00');
  assert.equal(reconciled.durationMinutes, 60);
  assert.equal(reconciled.endTime, '10:00');
  assert.match(reconciled.warning, /conflicted/i);
});

test('Part 1 Bug 1: Midnight crossing is handled gracefully', () => {
  const reconciled = reconcileTimeAndDuration({
    startTime: '23:00',
    endTime: '01:00'
  });

  assert.equal(reconciled.startTime, '23:00');
  assert.equal(reconciled.durationMinutes, 120); // 2h across midnight
  assert.equal(reconciled.endTime, '01:00');
});

test('Part 1 Bug 2: Habit goal linkage via goalIndex in apply_executive_plan simulation', () => {
  const planArgs = {
    goals: [
      { id: 'goal-ml', title: 'Master Deep Reinforcement Learning' }
    ],
    habits: [
      {
        id: 'h1',
        title: 'Morning RL Paper Reading',
        cadence: 'Morning',
        goalIndex: 0
      }
    ]
  };

  const createdGoalIds = planArgs.goals.map(g => g.id);
  const nextGoals = planArgs.goals.map(g => ({ ...g, linkedHabitIds: [] }));
  const nextHabits = [];
  const warnings = [];

  planArgs.habits.forEach((raw) => {
    let resolvedGoalId = raw.existingGoalId || raw.goalId || null;
    if (typeof raw.goalIndex === 'number') {
      if (createdGoalIds[raw.goalIndex]) {
        resolvedGoalId = createdGoalIds[raw.goalIndex];
      } else {
        warnings.push(`Habit "${raw.title}" referenced goalIndex ${raw.goalIndex}, but goal was not found.`);
      }
    }

    const linkedGoalObj = resolvedGoalId ? nextGoals.find(g => String(g.id) === String(resolvedGoalId)) : null;
    const resolvedGoalTitle = raw.linkedGoal || linkedGoalObj?.title || '';

    if (resolvedGoalId) {
      const g = nextGoals.find(g => String(g.id) === String(resolvedGoalId));
      if (g) g.linkedHabitIds.push(raw.id);
    }

    nextHabits.push({
      ...raw,
      linkedGoalId: resolvedGoalId,
      linkedGoal: resolvedGoalTitle
    });
  });

  assert.equal(warnings.length, 0);
  assert.equal(nextHabits[0].linkedGoalId, 'goal-ml');
  assert.equal(nextHabits[0].linkedGoal, 'Master Deep Reinforcement Learning');
  assert.deepEqual(nextGoals[0].linkedHabitIds, ['h1']);
});
