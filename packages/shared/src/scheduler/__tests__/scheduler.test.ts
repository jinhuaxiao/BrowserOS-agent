/**
 * Scheduler Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  createSchedule,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
  enableSchedule,
  disableSchedule,
  getScheduleStats,
  ensureScheduleDirectories,
  createCronSchedule,
  createIntervalSchedule,
  getNextCronTime,
  isValidCronExpression,
  describeCronExpression,
  parseInterval,
  describeInterval,
} from '../index.ts';
import type { ScheduledTask, CronTriggerConfig, IntervalTriggerConfig } from '../types.ts';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Test directory
const TEST_SCHEDULES_DIR = join(homedir(), '.craft-agent', 'browser-skills', 'schedules');

describe('Cron Trigger', () => {
  it('should validate cron expressions', () => {
    expect(isValidCronExpression('0 9 * * 1-5')).toBe(true);
    expect(isValidCronExpression('*/5 * * * *')).toBe(true);
    expect(isValidCronExpression('0 0 1 1 *')).toBe(true);
    expect(isValidCronExpression('invalid')).toBe(false);
    expect(isValidCronExpression('1 2 3')).toBe(false);
  });

  it('should calculate next cron time', () => {
    const now = new Date('2024-01-15T08:00:00');
    const next = getNextCronTime('0 9 * * *', undefined, now);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
    expect(next.getDate()).toBe(15);
  });

  it('should describe cron expressions', () => {
    expect(describeCronExpression('0 9 * * 1-5')).toContain('9AM');
    expect(describeCronExpression('*/5 * * * *')).toContain('minute');
  });
});

describe('Interval Trigger', () => {
  it('should parse interval strings', () => {
    expect(parseInterval('5m')).toBe(5 * 60 * 1000);
    expect(parseInterval('1h')).toBe(60 * 60 * 1000);
    expect(parseInterval('2d')).toBe(2 * 24 * 60 * 60 * 1000);
    expect(parseInterval('30s')).toBe(30 * 1000);
  });

  it('should describe intervals', () => {
    expect(describeInterval(60 * 60 * 1000)).toBe('every 1 hour');
    expect(describeInterval(5 * 60 * 1000)).toBe('every 5 minutes');
  });
});

describe('Schedule Storage', () => {
  beforeEach(() => {
    ensureScheduleDirectories();
    // Clean up any existing test schedules
    const schedules = listSchedules();
    schedules.forEach((s) => {
      if (s.name.startsWith('Test Schedule')) {
        deleteSchedule(s.id);
      }
    });
  });

  it('should create a cron schedule', () => {
    const schedule = createCronSchedule({
      name: 'Test Schedule Cron',
      expression: '0 9 * * 1-5',
      workflowId: 'wf_test123',
    });

    expect(schedule.id).toMatch(/^sch_/);
    expect(schedule.name).toBe('Test Schedule Cron');
    expect(schedule.trigger.type).toBe('cron');
    expect((schedule.trigger as CronTriggerConfig).expression).toBe('0 9 * * 1-5');
    expect(schedule.target.type).toBe('workflow');
    expect(schedule.enabled).toBe(true);
    expect(schedule.metadata.executionCount).toBe(0);
    expect(schedule.metadata.successRate).toBe(1.0);

    // Cleanup
    deleteSchedule(schedule.id);
  });

  it('should create an interval schedule', () => {
    const schedule = createIntervalSchedule({
      name: 'Test Schedule Interval',
      intervalMs: 60 * 60 * 1000,
      skillId: 'sk_test456',
    });

    expect(schedule.id).toMatch(/^sch_/);
    expect(schedule.trigger.type).toBe('interval');
    expect((schedule.trigger as IntervalTriggerConfig).intervalMs).toBe(60 * 60 * 1000);
    expect(schedule.target.type).toBe('skill');

    // Cleanup
    deleteSchedule(schedule.id);
  });

  it('should get a schedule by id', () => {
    const created = createCronSchedule({
      name: 'Test Schedule Get',
      expression: '0 0 * * *',
      workflowId: 'wf_test',
    });

    const retrieved = getSchedule(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.name).toBe('Test Schedule Get');

    // Cleanup
    deleteSchedule(created.id);
  });

  it('should update a schedule', () => {
    const created = createCronSchedule({
      name: 'Test Schedule Update',
      expression: '0 0 * * *',
      workflowId: 'wf_test',
    });

    const updated = updateSchedule(created.id, {
      name: 'Test Schedule Updated',
      description: 'Updated description',
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('Test Schedule Updated');
    expect(updated!.description).toBe('Updated description');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);

    // Cleanup
    deleteSchedule(created.id);
  });

  it('should enable and disable a schedule', () => {
    const created = createCronSchedule({
      name: 'Test Schedule Enable',
      expression: '0 0 * * *',
      workflowId: 'wf_test',
      enabled: false,
    });

    expect(created.enabled).toBe(false);

    enableSchedule(created.id);
    let schedule = getSchedule(created.id);
    expect(schedule!.enabled).toBe(true);

    disableSchedule(created.id);
    schedule = getSchedule(created.id);
    expect(schedule!.enabled).toBe(false);

    // Cleanup
    deleteSchedule(created.id);
  });

  it('should list schedules with filters', () => {
    const cron1 = createCronSchedule({
      name: 'Test Schedule List 1',
      expression: '0 0 * * *',
      workflowId: 'wf_test',
      enabled: true,
    });

    const cron2 = createCronSchedule({
      name: 'Test Schedule List 2',
      expression: '0 12 * * *',
      workflowId: 'wf_test2',
      enabled: false,
    });

    const allSchedules = listSchedules();
    expect(allSchedules.length).toBeGreaterThanOrEqual(2);

    const enabledSchedules = listSchedules({ enabled: true });
    const enabledIds = enabledSchedules.map((s) => s.id);
    expect(enabledIds).toContain(cron1.id);
    expect(enabledIds).not.toContain(cron2.id);

    const cronSchedules = listSchedules({ triggerType: 'cron' });
    expect(cronSchedules.length).toBeGreaterThanOrEqual(2);

    // Cleanup
    deleteSchedule(cron1.id);
    deleteSchedule(cron2.id);
  });

  it('should delete a schedule', () => {
    const created = createCronSchedule({
      name: 'Test Schedule Delete',
      expression: '0 0 * * *',
      workflowId: 'wf_test',
    });

    expect(getSchedule(created.id)).not.toBeNull();

    const deleted = deleteSchedule(created.id);
    expect(deleted).toBe(true);
    expect(getSchedule(created.id)).toBeNull();
  });

  it('should get schedule stats', () => {
    const created = createCronSchedule({
      name: 'Test Schedule Stats',
      expression: '0 0 * * *',
      workflowId: 'wf_test',
    });

    const stats = getScheduleStats(created.id);
    expect(stats).not.toBeNull();
    expect(stats!.executionCount).toBe(0);
    expect(stats!.successRate).toBe(1.0);
    expect(stats!.consecutiveFailures).toBe(0);

    // Cleanup
    deleteSchedule(created.id);
  });
});
