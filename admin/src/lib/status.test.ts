import { describe, it, expect } from 'vitest';
import { availableTransitions, canEdit, isQuestionStatus } from './status';

describe('availableTransitions', () => {
  it('lets the author submit a draft', () => {
    expect(availableTransitions('draft', 'writer', true)).toEqual(['in_review']);
  });

  it('gives other writers nothing on a draft', () => {
    expect(availableTransitions('draft', 'writer', false)).toEqual([]);
  });

  it("lets a reviewer approve or return someone else's question", () => {
    expect(availableTransitions('in_review', 'reviewer', false)).toEqual(['approved', 'needs_changes']);
  });

  it('never offers approval of your own question', () => {
    expect(availableTransitions('in_review', 'admin', true)).toEqual(['needs_changes']);
  });

  it('reserves publishing, suspending and resubmitting for admins', () => {
    expect(availableTransitions('approved', 'reviewer', false)).toEqual([]);
    expect(availableTransitions('approved', 'admin', false)).toEqual(['published']);
    expect(availableTransitions('published', 'admin', false)).toEqual(['suspended']);
    expect(availableTransitions('suspended', 'admin', false)).toEqual(['in_review']);
  });
});

describe('canEdit', () => {
  it('allows editing only in editable states, by the author or an admin', () => {
    expect(canEdit('needs_changes', 'writer', true)).toBe(true);
    expect(canEdit('in_review', 'writer', true)).toBe(false);
    expect(canEdit('published', 'admin', false)).toBe(false);
    expect(canEdit('suspended', 'admin', false)).toBe(true);
    expect(canEdit('draft', 'reviewer', false)).toBe(false);
  });
});

describe('isQuestionStatus', () => {
  it('recognises known statuses only', () => {
    expect(isQuestionStatus('published')).toBe(true);
    expect(isQuestionStatus('deleted')).toBe(false);
  });
});
