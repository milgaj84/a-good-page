import { describe, expect, it } from 'vitest';
import { ExportState } from '../src/core/export-state';
describe('PDF preview snapshot state', () => {
  it('closes an idle preview when the manuscript changes', () => {
    const state = new ExportState(); state.beginPreview();
    expect(state.manuscriptEdited()).toBe('close');
    expect(state.changedDuringSave).toBe(false);
  });
  it('marks later edits while a save dialog is pending, including cancellation', () => {
    const state = new ExportState(); state.beginPreview(); state.beginSave();
    expect(state.manuscriptEdited()).toBe('pending');
    expect(state.endSave()).toBe(true);
    state.beginPreview(); expect(state.changedDuringSave).toBe(false);
  });
  it('leaves a clean export unmarked', () => {
    const state = new ExportState(); state.beginPreview(); state.beginSave();
    expect(state.endSave()).toBe(false);
  });
});
