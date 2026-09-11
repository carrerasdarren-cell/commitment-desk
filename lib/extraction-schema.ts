import { z } from 'zod';
import { reconcile, type Source } from './domain.ts';

const EventsSchema = z.object({
  events: z
    .array(
      z.object({
        key: z
          .string()
          .min(2)
          .max(80)
          .describe(
            'Stable lowercase hyphenated ID. Reuse the SAME key for every update about the same deliverable.',
          ),
        title: z.string().min(1).max(120),
        owner: z
          .string()
          .max(80)
          .nullable()
          .overwrite((value) => (value === 'null' ? null : value)),
        dueDate: z
          .string()
          .nullable()
          .overwrite((value) => (value === 'null' ? null : value))
          .describe(
            'An explicit ISO deadline copied from the exact quote. Null if absent. Never use source header date or review date.',
          ),
        state: z.enum(['open', 'blocked', 'done', 'unclear']),
        sourceId: z.string(),
        clearsOwner: z
          .boolean()
          .describe(
            'True only when this quote explicitly withdraws the previous owner; otherwise false.',
          ),
        clearsDueDate: z
          .boolean()
          .describe(
            'True only when this quote explicitly withdraws the previous deadline; otherwise false.',
          ),
        quote: z
          .string()
          .min(1)
          .max(1600)
          .describe(
            'An EXACT unedited passage copied from the source body, including owner/deadline if provided.',
          ),
        detail: z
          .string()
          .max(350)
          .min(1)
          .describe('Brief supported explanation. Do not add information.'),
      }),
    )
    .max(60),
});

export function sourceEventsSchema(source: Source) {
  return EventsSchema.superRefine((value, ctx) => {
    value.events.forEach((event, index) => {
      const rejection = reconcile([event], [source], source.date).rejected[0];
      if (rejection) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', index],
          message: `${rejection.reason} Use only this source body as evidence. Set owner or dueDate to null when absent from the quote; source-header metadata is not evidence.`,
        });
      }
      if (
        (event.owner && event.clearsOwner) ||
        (event.dueDate && event.clearsDueDate)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', index],
          message:
            'A supplied owner or dueDate cannot also be cleared. Clear only an explicitly withdrawn value.',
        });
      }
    });
  });
}
